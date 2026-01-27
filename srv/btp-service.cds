using {btp.structure as db} from '../db/schema';
using {btp.config as cfg} from '../db/config';
using {btp.cache as cache} from '../db/cache';

service btpManagementService {

    //Cache
    entity Directories as projection on db.Directories;
    entity Subaccounts as projection on db.Subaccounts;
    entity SubaccountDetails as projection on db.SubaccountDetails;


    entity Users as projection on cache.CachedUsers;
  

    

    //Konfiguration
    entity DestinationMappings as projection on cfg.DestinationMappings;
    
    action RefreshStructure();
    
}

extend projection btpManagementService.Subaccounts with {
  users : Association to many btpManagementService.Users
    on users.subaccountGuid = $self.guid
}

// Navigation User -> Subaccount (für subaccount.name im UI)
extend projection btpManagementService.Users with {
  subaccount : Association to btpManagementService.Subaccounts
    on subaccount.guid = $self.subaccountGuid
};