const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { Directories, Subaccounts } = this.entities;

  console.log('📌 this.entities keys:', Object.keys(this.entities));


  // Remote (sollte als kind: "rest" konfiguriert sein)
  const btp = await cds.connect.to('BTP_MANAGEMENT_API');

  this.on('RefreshStructure', async (req) => {
    const tx = cds.transaction(req);

    // ✅ WICHTIG: kein "query:" Property benutzen, sonst interpretiert CAP das als CQN
    console.log('➡️ GET /accounts/v1/globalAccount?expand=true');
    const ga = await btp.send({
      method: 'GET',
      path: '/accounts/v1/globalAccount?expand=true'
    });

    const dirRows = [];
    const subRows = [];

    // Helper: pick first defined value
    const pick = (o, ...keys) => keys.map(k => o?.[k]).find(v => v !== undefined && v !== null);

    // Root (Global Account)
    const rootGuid = pick(ga, 'guid', 'id');
    const rootName = pick(ga, 'displayName', 'name') || '';

    // Optional: Global Account als "Root-Directory" speichern (wenn du willst)
    // dirRows.push({ guid: rootGuid, name: rootName, parentGuid: null, level: 0 });

    function walkDirectory(dir, parentGuid, level) {
      const guid = pick(dir, 'guid', 'id');
      if (!guid) return;

      dirRows.push({
        guid,
        name: pick(dir, 'displayName', 'name') || '',
        parentGuid: parentGuid || null,
        level
      });

      // Subaccounts unter diesem Directory
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

      // Child directories: API liefert "children"
      const children = pick(dir, 'children', 'directories') || [];
      for (const child of children) {
        walkDirectory(child, guid, level + 1);
      }
    }

    // Einstieg: Global Account liefert Directories in "children"
    const topDirs = ga?.children || [];
    for (const d of topDirs) {
      walkDirectory(d, rootGuid || null, 0);
    }

    console.log(`ℹ️ Flattened: ${dirRows.length} directories, ${subRows.length} subaccounts`);

    // DB refresh
    await tx.run(DELETE.from(Subaccounts));
    await tx.run(DELETE.from(Directories));
    if (dirRows.length) await tx.run(INSERT.into(Directories).entries(dirRows));
    if (subRows.length) await tx.run(INSERT.into(Subaccounts).entries(subRows));

    return { ok: true, directories: dirRows.length, subaccounts: subRows.length };
  });
});
