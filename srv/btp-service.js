const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { Directories, Subaccounts, SubaccountDetails } = this.entities;

  console.log('📌 Service init - entities:', Object.keys(this.entities || {}));
  console.log('📌 Has SubaccountDetails entity?', !!SubaccountDetails);

  // Remote Destination
  const btp = await cds.connect.to('BTP_MANAGEMENT_API');
  console.log('📌 Connected to remote service: BTP_MANAGEMENT_API');

  // ---------------------------------------------------------
  // Refresh Structure (Directory + Subaccounts)
  // ---------------------------------------------------------
  this.on('RefreshStructure', async (req) => {
    const tx = cds.transaction(req);
    console.log('✅ Action RefreshStructure called');

    console.log('➡️ REMOTE GET /accounts/v1/globalAccount?expand=true');
    const ga = await btp.send({
      method: 'GET',
      path: '/accounts/v1/globalAccount?expand=true'
    });

    const dirRows = [];
    const subRows = [];
    const pick = (o, ...keys) => keys.map(k => o?.[k]).find(v => v !== undefined && v !== null);

    const rootGuid = pick(ga, 'guid', 'id');
    console.log('ℹ️ rootGuid:', rootGuid);

    function walkDirectory(dir, parentGuid, level) {
      const guid = pick(dir, 'guid', 'id');
      if (!guid) return;

      dirRows.push({
        guid,
        name: pick(dir, 'displayName', 'name') || '',
        parentGuid: parentGuid || null,
        level
      });

      const subs = pick(dir, 'subaccounts') || [];
      for (const s of subs) {
        const sguid = pick(s, 'guid', 'id');
        if (!sguid) continue;

        subRows.push({
          guid: sguid,
          name: pick(s, 'displayName', 'name') || '',
          region: pick(s, 'region') || '',
          state: pick(s, 'state') || '',
          parentGuid: guid,
          level: level + 1
        });
      }

      const children = pick(dir, 'children', 'directories') || [];
      for (const child of children) walkDirectory(child, guid, level + 1);
    }

    for (const d of (ga?.children || [])) walkDirectory(d, rootGuid || null, 0);

    console.log(`ℹ️ Flattened: ${dirRows.length} directories, ${subRows.length} subaccounts`);

    console.log('🧹 DB refresh: DELETE Subaccounts, Directories');
    await tx.run(DELETE.from(Subaccounts));
    await tx.run(DELETE.from(Directories));

    console.log('➕ DB insert:', { directories: dirRows.length, subaccounts: subRows.length });
    if (dirRows.length) await tx.run(INSERT.into(Directories).entries(dirRows));
    if (subRows.length) await tx.run(INSERT.into(Subaccounts).entries(subRows));

    console.log('✅ RefreshStructure done');
    return { ok: true, directories: dirRows.length, subaccounts: subRows.length };
  });

  // ---------------------------------------------------------
  // Helper: Detect "Object Page read" (= by key)
  // ---------------------------------------------------------
  function isReadByKey(req) {
    // OData V4 by-key typically has req.data.id set
    return req?.event === 'READ' && req?.data && (req.data.id || req.data.guid);
  }

  function logReqPrefix(req) {
    const id = req?.id || req?.headers?.['x-correlation-id'] || '';
    return id ? `[#${id}]` : '[READ]';
  }

  // ---------------------------------------------------------
  // Helper: Fetch + UPSERT details
  // ---------------------------------------------------------
  async function refreshSubaccountDetails(guid, req) {
    const p = logReqPrefix(req);
    const tx = cds.transaction(req);

    console.log(`${p} 🔎 refreshSubaccountDetails(guid=${guid})`);

    if (!SubaccountDetails) {
      console.error(`${p} ❌ SubaccountDetails entity not available (check service projection + destructuring)`);
      return;
    }

    let existing;
    try {
      existing = await tx.run(
        SELECT.one.from(SubaccountDetails)
          .columns('id', 'fetchedAt', 'subaccountGuid')
          .where({ subaccountGuid: guid })
      );
      console.log(`${p} ℹ️ existing details:`, existing || null);
    } catch (e) {
      console.error(`${p} ❌ SELECT SubaccountDetails failed:`, e.message);
      throw e;
    }

    const now = new Date();
    const maxAgeMs = 10 * 60 * 1000;
    const stale = !existing?.fetchedAt || (now - new Date(existing.fetchedAt)) > maxAgeMs;
    console.log(`${p} ℹ️ cache stale?`, stale, 'fetchedAt=', existing?.fetchedAt || null);

    if (!stale) {
      console.log(`${p} ✅ cache fresh, skip remote call`);
      return;
    }

    // remote call
    console.log(`${p} ➡️ REMOTE GET /accounts/v1/subaccounts/${guid}`);
    let d;
    try {
      d = await btp.send({
        method: 'GET',
        path: `/accounts/v1/subaccounts/${encodeURIComponent(guid)}`
      });
      console.log(`${p} ✅ remote response keys:`, Object.keys(d || {}));
    } catch (e) {
      console.error(`${p} ❌ remote call failed:`, e.message);
      throw e;
    }

    // ========= Mapping =========
    // OPTION A: wenn dein schema.cds diese Felder hat:
    // subdomain, createdAt, modifiedAt, fetchedAt, ownerEmail
    const rowA = {
      id: existing?.id || cds.utils.uuid(),
      subaccountGuid: guid,
      subdomain: d?.subdomain ?? d?.subDomain ?? null,
      createdAt: d?.createdAt ? new Date(d.createdAt) : null,
      modifiedAt: d?.modifiedAt ? new Date(d.modifiedAt) : null,
      ownerEmail: d?.ownerEmail ?? null,
      fetchedAt: now
    };

    // OPTION B: wenn dein schema.cds NUR createdAt + ownerEmail hat:
    // const rowB = {
    //   id: existing?.id || cds.utils.uuid(),
    //   subaccountGuid: guid,
    //   createdAt: d?.createdAt ? new Date(d.createdAt) : null,
    //   ownerEmail: d?.ownerEmail ?? null
    // };

    // ✅ Wähle genau 1 Zeile:
    const row = rowA; // <- oder rowB

    console.log(`${p} 🧾 UPSERT payload:`, row);

    try {
      await tx.run(UPSERT.into(SubaccountDetails).entries(row));
      console.log(`${p} ✅ UPSERT SubaccountDetails ok`);
    } catch (e) {
      console.error(`${p} ❌ UPSERT SubaccountDetails failed:`, e.message);
      throw e;
    }
  }

  // ---------------------------------------------------------
  // BEFORE READ Subaccounts (Object Page)
  // ---------------------------------------------------------
  this.before('READ', Subaccounts, async (req) => {
    const p = logReqPrefix(req);

    console.log(`${p} BEFORE READ Subaccounts`);
    console.log(`${p} req.data=`, req.data);
    console.log(`${p} req.query=`, JSON.stringify(req.query || {}, null, 2));
    console.log(`${p} expand?`, req.query?.SELECT?.columns?.some(c => c.expand) ? 'yes' : 'no');

    if (!isReadByKey(req)) {
      console.log(`${p} (skip) not by-key read (likely list/table)`);
      return;
    }

    // If read uses id as key, look up guid
    let guid = req.data.guid;

    if (!guid && req.data.id) {
      console.log(`${p} 🔎 resolving guid by id=${req.data.id}`);
      try {
        const row = await SELECT.one.from(Subaccounts).columns('guid').where({ id: req.data.id });
        guid = row?.guid;
        console.log(`${p} ✅ resolved guid=`, guid || null);
      } catch (e) {
        console.error(`${p} ❌ guid lookup failed:`, e.message);
        throw e;
      }
    }

    if (!guid) {
      console.warn(`${p} ⚠️ no guid found, cannot fetch details`);
      return;
    }

    await refreshSubaccountDetails(guid, req);
  });

  // ---------------------------------------------------------
  // AFTER READ Subaccounts (extra visibility)
  // ---------------------------------------------------------
  this.after('READ', Subaccounts, async (result, req) => {
    const p = logReqPrefix(req);
    const byKey = isReadByKey(req);

    console.log(`${p} AFTER READ Subaccounts (byKey=${byKey})`);
    if (byKey && result && !Array.isArray(result)) {
      console.log(`${p} result.id=`, result.id, 'result.guid=', result.guid);
    }
  });
});
