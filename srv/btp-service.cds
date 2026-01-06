using {btp.structure as db} from '../db/schema';

service btpManagementService {
    entity Directories as projection on db.Directories;
    entity Subaccounts as projection on db.Subaccounts;
    entity SubaccountDetails as projection on db.SubaccountDetails;
    
    entity Users        as projection on db.Users;

    action RefreshStructure();
    
}


