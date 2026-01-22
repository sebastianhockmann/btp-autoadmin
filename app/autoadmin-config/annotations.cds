using btpManagementService as service from '../../srv/btp-service';



annotate service.DestinationMappings with @odata.draft.enabled;
annotate service.DestinationMappings with @Common.SemanticKey: [ID];

annotate service.DestinationMappings with @(

  
    
  UI.LineItem : [
    { $Type: 'UI.DataField', Label: 'Subaccount',      Value: subaccount.name },
    { $Type: 'UI.DataField', Label: 'Subaccount GUID', Value: subaccountGuid },
    { $Type: 'UI.DataField', Label: 'Destination',     Value: destinationName },
    { $Type: 'UI.DataField', Label: 'Active',          Value: active }
  ],
  UI.SelectionFields : [ subaccountGuid, destinationName, active ],

  UI.Facets : [
    { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' }
  ],
  UI.FieldGroup #General : {
    $Type: 'UI.FieldGroupType',
    Data: [
      { $Type: 'UI.DataField', Label: 'Subaccount GUID', Value: subaccountGuid },
      { $Type: 'UI.DataField', Label: 'Destination',     Value: destinationName },
      { $Type: 'UI.DataField', Label: 'Active',          Value: active }
    ]
  }
);

// Text + Arrangement (damit in der UI nicht nur GUID steht)
annotate service.DestinationMappings with {
  subaccountGuid @Common.Text            : subaccount.name;
  subaccountGuid @Common.TextArrangement : #TextLast;

  subaccountGuid @Common.ValueList : {
    $Type          : 'Common.ValueListType',
    CollectionPath : 'Subaccounts',
    Parameters     : [
      {
        $Type             : 'Common.ValueListParameterInOut',
        LocalDataProperty : subaccountGuid,
        ValueListProperty : 'guid'
      },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'region' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'state' }
    ]
  };
};
