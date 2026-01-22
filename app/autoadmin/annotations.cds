using btpManagementService as service from '../../srv/btp-service';

annotate service.Directories with @(
  UI.LineItem : [
    {
      $Type  : 'UI.DataFieldForAction',
      Action : 'RefreshStructure',
      Label  : 'Refresh Structure'
    },
    { $Type : 'UI.DataField', Label : 'Name',        Value : name },
    { $Type : 'UI.DataField', Label : 'GUID',        Value : guid },
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
      Target : 'subaccounts/@UI.LineItem#InDirectoryFacet'
    }
  ],

  UI.FieldGroup #DirGeneral : {
    $Type : 'UI.FieldGroupType',
    Data : [
      { $Type : 'UI.DataField', Label : 'GUID',        Value : guid },
      { $Type : 'UI.DataField', Label : 'Name',        Value : name },
      { $Type : 'UI.DataField', Label : 'Parent GUID', Value : parentGuid },
      { $Type : 'UI.DataField', Label : 'Level',       Value : level }
    ]
  }
);

annotate service.Subaccounts with @(

  UI.LineItem : [
    { $Type : 'UI.DataField', Label : 'Name',   Value : name },
    { $Type : 'UI.DataField', Label : 'Region', Value : region },
    { $Type : 'UI.DataField', Label : 'State',  Value : state }
  ],
  UI.SelectionFields : [ name, region, state ],

  // Facet-Tabelle im Directory
  UI.LineItem #InDirectoryFacet : [
    { $Type : 'UI.DataField', Value : id, ![@UI.Hidden] : true },
    { $Type : 'UI.DataField', Label : 'Name',   Value : name },
    { $Type : 'UI.DataField', Label : 'Region', Value : region },
    { $Type : 'UI.DataField', Label : 'State',  Value : state }
  ],

  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'SubaccountGeneral',
      Label  : 'General Information',
      Target : '@UI.FieldGroup#SubGeneral'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'SubaccountDetails',
      Label  : 'Details',
      Target : '@UI.FieldGroup#SubDetails'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'SubaccountUsers',
      Label  : 'Users',
      Target : 'users/@UI.LineItem'
    }




  ],

  UI.FieldGroup #SubGeneral : {
    $Type : 'UI.FieldGroupType',
    Data : [
      { $Type : 'UI.DataField', Label : 'GUID',       Value : guid },
      { $Type : 'UI.DataField', Label : 'Name',       Value : name },
      { $Type : 'UI.DataField', Label : 'Region',     Value : region },
      { $Type : 'UI.DataField', Label : 'State',      Value : state },
      { $Type : 'UI.DataField', Label : 'Parent GUID',Value : parentGuid },
      { $Type : 'UI.DataField', Label : 'Level',      Value : level }
    ]
  },

  UI.FieldGroup #SubDetails : {
    $Type : 'UI.FieldGroupType',
    Data : [
      { $Type : 'UI.DataField', Label : 'Owner Email', Value : details.ownerEmail },
      { $Type : 'UI.DataField', Label : 'Created At',  Value : details.createdAt }
    ]
  }
);

annotate service.Users with @(
  UI.LineItem : [
    { $Type : 'UI.DataField', Label : 'First Name', Value : firstName },
    { $Type : 'UI.DataField', Label : 'Last Name',  Value : lastName  },
    { $Type : 'UI.DataField', Label : 'E-Mail',     Value : email     },
    { $Type : 'UI.DataField', Label : 'Origin',     Value : origin    }
  ]
);
