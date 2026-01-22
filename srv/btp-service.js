const cds = require('@sap/cds');
const { getDestination } = require('@sap-cloud-sdk/connectivity');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');


module.exports = cds.service.impl(async function () {
  const { Directories, Subaccounts, SubaccountDetails, DestinationMappings, Users } = this.entities;

    

  console.log('📌 Service init - entities:', Object.keys(this.entities || {}));
  console.log('📌 Has SubaccountDetails entity?', !!SubaccountDetails);

  // BTP Destination
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
function _tryExtractIdFromRefWhere(fromRefArray) {
  // fromRefArray looks like:
  // [
  //   { id:"btpManagementService.Directories", where:[ {ref:["id"]},"=",{val:"..."} ] },
  //   { id:"subaccounts", where:[ {ref:["id"]},"=",{val:"..."} ] }
  // ]
  for (const r of fromRefArray || []) {
    if (r?.id === 'subaccounts' && Array.isArray(r.where)) {
      // find pattern: ref ["id"] = val "<uuid>"
      for (let i = 0; i < r.where.length - 2; i++) {
        const a = r.where[i], b = r.where[i + 1], c = r.where[i + 2];
        if (a?.ref?.[0] === 'id' && b === '=' && c?.val) return c.val;
      }
    }
  }
  return null;
}

async function resolveSubaccountGuidFromReq(req, Subaccounts) {
  // 1) direct
  if (req?.data?.subaccountGuid) return req.data.subaccountGuid;
  if (req?.data?.guid) return req.data.guid;

  // 2) navigation params
// bei /Directories(...)/subaccounts(...)/users gibt es 2 parents -> der letzte ist der Subaccount
const parents = Array.isArray(req?.params) ? req.params : [];
const parent = parents.length ? parents[parents.length - 1] : null;

if (parent?.guid) return parent.guid;

const parentId = parent?.id || parent?.ID;
if (parentId) {
  const row = await SELECT.one.from(Subaccounts).columns('guid').where({ id: parentId });
  return row?.guid || null;
}

  // 3) navigation encoded in query (your case)
  const from = req?.query?.SELECT?.from;
  const refArr = from?.ref;
  if (Array.isArray(refArr)) {
    const subId = _tryExtractIdFromRefWhere(refArr);
    if (subId) {
      const row = await SELECT.one.from(Subaccounts).columns('guid').where({ id: subId });
      return row?.guid || null;
    }
  }

  return null;
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


  // ---------------------------------------------------------
  // READ Users (virtual) - destination lookup by subaccountGuid
  // ---------------------------------------------------------
  this.on('READ', Users, async (req) => {
    const p = logReqPrefix(req);
    console.log(`${p} READ Users`);

    const subGuid = await resolveSubaccountGuidFromReq(req, Subaccounts);
    console.log(`${p} req.data=`, req.data);
    console.log(`${p} req.params=`, req.params);
    console.log(`${p} req.query.from=`, JSON.stringify(req?.query?.SELECT?.from, null, 2));
    
    console.log(`${p} Users for subaccountGuid=`, subGuid);

    if (!subGuid) {
      console.log(`${p} (skip) no subaccountGuid in request context`);
      return [];
    }

    // DestinationMapping aus DB holen
    const tx = cds.transaction(req);
    const mapping = await tx.run(
      SELECT.one.from(DestinationMappings)
        .columns('destinationName', 'active')
        .where({ subaccountGuid: subGuid, active: true })
    );

    if (!mapping?.destinationName) {
      console.log(`${p} ❌ No active DestinationMapping found for subaccountGuid=${subGuid}`);
      return [];
    }

    console.log(`${p} ✅ Using destination: ${mapping.destinationName}`);

    const destination = await getDestination({ destinationName: mapping.destinationName });
  if (!destination) {
    console.log(`${p} ❌ Destination not found in Destination Service: ${mapping.destinationName}`);
    return [];
  }

  // 3) Paging aus OData übernehmen
  const top = req.query?.SELECT?.limit?.rows?.val ?? 50;
  const skip = req.query?.SELECT?.limit?.offset?.val ?? 0;

  // 4) Identifier bestimmen (Beispiel: aus Details/Subdomain oder anderem Feld)
  // -> Hier musst du entscheiden, was zur API passt:
  //    Neo-Doku spricht von technical name, nicht GUID.
  const sub = await tx.run(SELECT.one.from(Subaccounts).columns('guid','name').where({ guid: subGuid }));
  const subaccountIdForApi = sub?.guid; // <-- ggf. ersetzen!

  console.log(`${p} ℹ️ subaccountIdForApi=`, subaccountIdForApi);

  // 5) Remote Call (Pfad hängt davon ab, wohin die Destination zeigt)
  const res = await executeHttpRequest(destination, {
    method: 'GET',
      url: `/Users`
    
  });

  /*
  console.log('Authorization header:', authHeader);
  console.log('HTTP status:', res.status);
  console.log('Raw response:', res.data);
  */

  const users = Array.isArray(res.data) ? res.data : (res.data?.users ?? []);
  console.log(`${p} ✅ Remote users count:`, users.length);

  // 6) Auf deine Entity mappen
  return users.slice(skip, skip + top).map(u => ({
    id: u.id ?? u.userId ?? cds.utils.uuid(),
    subaccountGuid: subGuid,
    firstName: u.firstName ?? '',
    lastName:  u.lastName ?? '',
    email:     u.email ?? u.userName ?? '',
    origin:    u.origin ?? ''
  }));


    /*
    // TODO: hier kommt später der echte API call über die Destination hin
    // für jetzt: Dummy-User, damit die Tabelle in der UI sichtbar wird
    return [
      {
        id: `dummy-${subGuid}`,
        subaccountGuid: subGuid,
        firstName: 'Dummy',
        lastName: 'User',
        email: 'dummy@example.com',
        origin: 'TEST'
      }
    ];*/



    
  });


});
