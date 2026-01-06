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
  key id           : UUID;
      subaccountGuid : String;
      fetchedAt    : Timestamp;
      createdAt    : Timestamp;
      ownerEmail   : String;
}

entity Users {
  key id        : String;
      firstName : String;
      lastName  : String;
      email     : String;
}
