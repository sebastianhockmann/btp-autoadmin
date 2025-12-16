namespace btp.structure;

entity Directories {
  key id           : UUID;
      guid         : String;
      name         : String;
      parentGuid   : String;
      level        : Integer;

      subaccounts : Association to many Subaccounts
            on subaccounts.parentGuid = $self.guid;

}

entity  Subaccounts {
key id           : UUID;
      guid         : String;
      name         : String;
      region       : String;
      state        : String;
      parentGuid   : String; 
      level        : Integer;
}

entity Users {
  key id        : String;   
      firstName : String;
      lastName  : String;
      email     : String;
}
