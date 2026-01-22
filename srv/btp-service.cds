using {btp.structure as db} from '../db/schema';
using {btp.config as cfg} from '../db/config';

service btpManagementService {

    //Cache
    entity Directories as projection on db.Directories;
    entity Subaccounts as projection on db.Subaccounts;
    entity SubaccountDetails as projection on db.SubaccountDetails;


    @cds.persistence.skip
    entity Users {
    key id            : String;
        subaccountGuid : String(36);
        firstName      : String;
        lastName       : String;
        email          : String;
        origin         : String;
  }
    

    //Konfiguration
    entity DestinationMappings as projection on cfg.DestinationMappings;
    
    action RefreshStructure();
    
}

extend projection btpManagementService.Subaccounts with {
  users : Association to many btpManagementService.Users
    on users.subaccountGuid = $self.guid
}


