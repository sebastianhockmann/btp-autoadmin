using btpManagementService as service from '../../srv/btp-service';

/** -----------------------------
 *  Directories: List + Object Page
 *  ----------------------------- */
annotate service.Directories with @(
  UI.LineItem : [
    {
      $Type  : 'UI.DataFieldForAction',
      Action : 'btpManagementService.RefreshStructure',
      Label  : 'Refresh Structure'
    },
    { $Type : 'UI.DataField', Label : 'Name', Value : name },
    { $Type : 'UI.DataField', Label : 'GUID', Value : guid },
    { $Type : 'UI.DataField', Label : 'Parent GUID', Value : parentGuid }
  ],

  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'DirectoryGeneral',
      Label  : 'General Information',
      Target : '@UI.FieldGroup#DirGeneral'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'DirectorySubaccounts',
      Label  : 'Subaccounts',
      Target : 'subaccounts/@UI.LineItem'     
    }
  ],

  UI.FieldGroup #DirGeneral : {
    $Type : 'UI.FieldGroupType',
    Data : [
      { $Type : 'UI.DataField', Label : 'GUID', Value : guid },
      { $Type : 'UI.DataField', Label : 'Name', Value : name },
      { $Type : 'UI.DataField', Label : 'Parent GUID', Value : parentGuid },
      { $Type : 'UI.DataField', Label : 'Level', Value : level }
    ]
  }
);

/** -----------------------------
 *  Subaccounts: Tabelle (für Facet + optional eigener List Report)
 *  ----------------------------- */
annotate service.Subaccounts with @(
  UI.LineItem : [
    { $Type : 'UI.DataField', Label : 'Name', Value : name },
    { $Type : 'UI.DataField', Label : 'Region', Value : region },
    { $Type : 'UI.DataField', Label : 'State', Value : state }
  ],
  UI.SelectionFields : [ name, region, state ]
);
