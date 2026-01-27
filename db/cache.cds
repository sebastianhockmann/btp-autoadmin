namespace btp.cache;

entity CachedUsers {
     key     subaccountGuid: String(36);
      key id            : String;     
 
      email         : String;
      firstName     : String;
      lastName      : String;
      origin        : String;
      fetchedAt     : Timestamp;
}
