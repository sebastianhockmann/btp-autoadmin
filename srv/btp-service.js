// srv/btp-service.js
const cds = require('@sap/cds');
const { getDestination } = require('@sap-cloud-sdk/connectivity');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

module.exports = cds.service.impl(async function () {
  const { Directories, Subaccounts, SubaccountDetails, DestinationMappings, Users } = this.entities;

  console.log('📌 Service init - entities:', Object.keys(this.entities || {}));
  console.log('📌 Has SubaccountDetails entity?', !!SubaccountDetails);

  // BTP Management API (remote)
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
  // Helpers
  // ---------------------------------------------------------
  function isReadByKey(req) {
    return req?.event === 'READ' && req?.data && (req.data.id || req.data.guid);
  }

  function logReqPrefix(req) {
    const id = req?.id || req?.headers?.['x-correlation-id'] || '';
    return id ? `[#${id}]` : '[READ]';
  }

  function _tryExtractIdFromRefWhere(fromRefArray) {
    for (const r of fromRefArray || []) {
      if (r?.id === 'subaccounts' && Array.isArray(r.where)) {
        for (let i = 0; i < r.where.length - 2; i++) {
          const a = r.where[i], b = r.where[i + 1], c = r.where[i + 2];
          if (a?.ref?.[0] === 'id' && b === '=' && c?.val) return c.val;
        }
      }
    }
    return null;
  }

  async function resolveSubaccountGuidFromReq(req) {
    if (req?.data?.subaccountGuid) return req.data.subaccountGuid;
    if (req?.data?.guid) return req.data.guid;

    // navigation params: last parent is subaccount
    const parents = Array.isArray(req?.params) ? req.params : [];
    const parent = parents.length ? parents[parents.length - 1] : null;

    if (parent?.guid) return parent.guid;

    const parentId = parent?.id || parent?.ID;
    if (parentId) {
      const row = await SELECT.one.from(Subaccounts).columns('guid').where({ id: parentId });
      return row?.guid || null;
    }

    // navigation encoded in query
    const refArr = req?.query?.SELECT?.from?.ref;
    if (Array.isArray(refArr)) {
      const subId = _tryExtractIdFromRefWhere(refArr);
      if (subId) {
        const row = await SELECT.one.from(Subaccounts).columns('guid').where({ id: subId });
        return row?.guid || null;
      }
    }

    return null;
  }

  function addWhereAnd(q, expr) {
    // expr is CQN where array like: [{ref:['subaccountGuid']}, '=', {val:'...'}]
    const sel = q?.SELECT;
    if (!sel) return;

    if (!sel.where || sel.where.length === 0) {
      sel.where = expr;
      return;
    }
    // AND existing with new expr
    sel.where = ['(', ...sel.where, ')', 'and', '(', ...expr, ')'];
  }

  // ---------------------------------------------------------
  // Subaccount Details (cache)
  // ---------------------------------------------------------
  async function refreshSubaccountDetails(guid, req) {
    const p = logReqPrefix(req);
    const tx = cds.transaction(req);

    console.log(`${p} 🔎 refreshSubaccountDetails(guid=${guid})`);

    const existing = await tx.run(
      SELECT.one.from(SubaccountDetails)
        .columns('id', 'fetchedAt', 'subaccountGuid')
        .where({ subaccountGuid: guid })
    );

    const now = new Date();
    const maxAgeMs = 10 * 60 * 1000;
    const stale = !existing?.fetchedAt || (now - new Date(existing.fetchedAt)) > maxAgeMs;
    console.log(`${p} ℹ️ details cache stale?`, stale, 'fetchedAt=', existing?.fetchedAt || null);

    if (!stale) return;

    console.log(`${p} ➡️ REMOTE GET /accounts/v1/subaccounts/${guid}`);
    const d = await btp.send({
      method: 'GET',
      path: `/accounts/v1/subaccounts/${encodeURIComponent(guid)}`
    });

    const row = {
      id: existing?.id || cds.utils.uuid(),
      subaccountGuid: guid,
      subdomain: d?.subdomain ?? d?.subDomain ?? null,
      createdAt: d?.createdAt ? new Date(d.createdAt) : null,
      modifiedAt: d?.modifiedAt ? new Date(d.modifiedAt) : null,
      ownerEmail: d?.ownerEmail ?? null,
      fetchedAt: now
    };

    console.log(`${p} 🧾 UPSERT SubaccountDetails payload:`, row);
    await tx.run(UPSERT.into(SubaccountDetails).entries(row));
    console.log(`${p} ✅ UPSERT SubaccountDetails ok`);
  }

  // ---------------------------------------------------------
  // Users refresh (remote -> persisted cache)
  // ---------------------------------------------------------
  async function refreshUsersForSubaccount(subGuid, req) {
    const p = logReqPrefix(req);
    const tx = cds.transaction(req);

    const mapping = await tx.run(
      SELECT.one.from(DestinationMappings)
        .columns('destinationName')
        .where({ subaccountGuid: subGuid, active: true })
    );

    if (!mapping?.destinationName) {
      console.log(`${p} ❌ No active DestinationMapping found for subaccountGuid=${subGuid}`);
      return;
    }

    const destination = await getDestination({ destinationName: mapping.destinationName });
    if (!destination) {
      console.log(`${p} ❌ Destination not found: ${mapping.destinationName}`);
      return;
    }

    const now = new Date();
    const maxAgeMs = 10 * 60 * 1000;

    const latest = await tx.run(
      SELECT.one.from(Users)
        .columns('fetchedAt')
        .where({ subaccountGuid: subGuid })
        .orderBy({ fetchedAt: 'desc' })
    );

    const stale = !latest?.fetchedAt || (now - new Date(latest.fetchedAt)) > maxAgeMs;
    console.log(`${p} ℹ️ users cache stale?`, stale, 'latest.fetchedAt=', latest?.fetchedAt || null);

    if (!stale) return;

    const url = '/Users';
    const baseUrl =
      destination.url ||
      destination.uri ||
      destination.originalProperties?.URL ||
      destination.originalProperties?.url ||
      '(unknown base url)';

    console.log(`${p} 🌐 API CALL -> ${baseUrl}${url}`);

    const res = await executeHttpRequest(destination, {
      method: 'GET',
      url,
      headers: { Accept: 'application/json' }
    });

    console.log(`${p} HTTP status:`, res.status);

    const remoteUsers =
      res.data?.Resources ||
      res.data?.resources ||
      res.data?.users ||
      (Array.isArray(res.data) ? res.data : []);

    console.log(`${p} Remote users count:`, Array.isArray(remoteUsers) ? remoteUsers.length : 0);

    if (!Array.isArray(remoteUsers) || remoteUsers.length === 0) return;

    const rows = remoteUsers.map(u => ({
      id: u.id ?? u.userId ?? u.userName ?? cds.utils.uuid(),
      subaccountGuid: subGuid,
      email: (u.emails?.[0]?.value) ?? u.email ?? u.userName ?? '',
      firstName: u?.name?.givenName ?? u.firstName ?? '',
      lastName: u?.name?.familyName ?? u.lastName ?? '',
      origin: u.origin ?? 'IAS',
      fetchedAt: now
    }));

    // Replace cache for this subaccount to avoid duplicates over time
    await tx.run(DELETE.from(Users).where({ subaccountGuid: subGuid }));
    await tx.run(INSERT.into(Users).entries(rows));

    console.log(`${p} ✅ REFRESH Users ok (${rows.length})`);
  }

  // ---------------------------------------------------------
  // BEFORE READ Subaccounts (Object Page): ONLY details refresh
  // (Users refresh moved to Users handler to avoid parallel refreshes)
  // ---------------------------------------------------------
  this.before('READ', Subaccounts, async (req) => {
    const p = logReqPrefix(req);

    console.log(`${p} BEFORE READ Subaccounts`);
    console.log(`${p} req.data=`, req.data);
    console.log(`${p} expand?`, req.query?.SELECT?.columns?.some(c => c.expand) ? 'yes' : 'no');

    if (!isReadByKey(req)) return;

    let guid = req.data.guid;
    if (!guid && req.data.id) {
      console.log(`${p} 🔎 resolving guid by id=${req.data.id}`);
      const row = await SELECT.one.from(Subaccounts).columns('guid').where({ id: req.data.id });
      guid = row?.guid;
      console.log(`${p} ✅ resolved guid=`, guid || null);
    }

    if (!guid) return;

    await refreshSubaccountDetails(guid, req);
  });

  // ---------------------------------------------------------
  // READ Users: refresh-if-stale + then return req.query (keeps $filter/$top/$skip)
  // ---------------------------------------------------------
 this.on('READ', Users, async (req) => {
  const p = logReqPrefix(req);
  const tx = cds.transaction(req);

  console.log(`${p} READ Users`);
  const subGuid = await resolveSubaccountGuidFromReq(req, Subaccounts);
  console.log(`${p} Users for subaccountGuid=`, subGuid);

  // Helper: CQN WHERE sauber erweitern
  function addWhereAnd(q, expr) {
    const sel = q.SELECT;
    if (!sel.where || sel.where.length === 0) {
      sel.where = expr;
    } else {
      sel.where = ['(', ...sel.where, ')', 'and', ...expr];
    }
  }

  if (subGuid) {
    await refreshUsersForSubaccount(subGuid, req);

 
    const q = JSON.parse(JSON.stringify(req.query));

    addWhereAnd(q, [{ ref: ['subaccountGuid'] }, '=', { val: subGuid }]);

    return tx.run(q);
  }


  return tx.run(req.query);
});
});
