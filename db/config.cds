namespace btp.config;

using { cuid, managed} from '@sap/cds/common';
using { btp.structure as s } from './schema';

entity DestinationMappings : cuid, managed{
  
      subaccountGuid  : String(36);
      destinationName : String(120);
      active          : Boolean default true;

  subaccount : Association to one s.Subaccounts
    on subaccount.guid = $self.subaccountGuid;
}
