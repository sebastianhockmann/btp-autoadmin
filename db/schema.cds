namespace btp.structure;

entity Directories {
  key id         : UUID;
      guid       : String;
      name       : String;
      parentGuid : String;
      level      : Integer;

      subaccounts : Association to many Subaccounts
        on subaccounts.parentGuid = $self.guid;
}

entity Subaccounts {
  key id          : UUID;
      guid        : String;
      name        : String;
      region      : String;
      state       : String;
      parentGuid  : String;
      level       : Integer;
      betaEnabled : Boolean;
      displayName : String;

      details : Association to one SubaccountDetails
        on details.subaccountGuid = $self.guid;
}

entity SubaccountDetails {
  key id                : UUID;
      subaccountGuid    : String;
      fetchedAt         : Timestamp;
      createdBy         : String;
      createdDate       : String;
      description       : String;
      displayName       : String;
      globalAccountID   : String;
      ownerEmail        : String;
      modifiedDate      : String;
      region            : String;
      state             : String;
      stateMessage      : String;
      subdomain         : String;
      technicalName     : String;
      usedForProduction : String;

}

entity Users {
  key id        : String;
      firstName : String;
      lastName  : String;
      email     : String;
      origin    : String;   // 'IAS' | 'BTP' | 'CF'
}


// Configuration
entity SubaccountConnections {
  key subaccountGuid : String;          
      destinationName: String;          
      active         : Boolean default true;
      note           : String;
      updatedAt      : Timestamp;
}


