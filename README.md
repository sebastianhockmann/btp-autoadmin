# Resources

https://discovery-center.cloud.sap/serviceCatalog/cloud-management-service?region=all
https://help.sap.com/docs/btp/sap-business-technology-platform/account-administration-using-apis-of-sap-cloud-management-service
https://help.sap.com/docs/btp/sap-business-technology-platform/sap-cloud-management-service-service-plans

# Architektur
* API werden gelesen und die Daten in der (HANA) DB persistiert
* Das ermöglicht die Nutzung von OData v4 und Fiori Elements 
* BTP User Management API
     * eine Instanz XSUAA pro Subaccount mit Plan apiaccess
     * AutoAdmin braucht eine Destination zu diesem Subaccount
     * notwendige Konfiguration kann in DB gespeichert werden
     * --> wird die package.json zum lesen der destination benötigt bzw. wie führe ich das cds.connect durch?



# API
Core Services for SAP BTP - https://api.sap.com/api/APIAccountsService/overview
User #1 --> https://api.sap.com/api/IdDS_SCIM/overview


SAP Authorization and Trust Management Service --> https://api.sap.com/package/authtrustmgmnt/rest



User #2 --> https://api.sap.com/api/PlatformAPI/overview
     --> https://api.sap.com/api/PlatformAPI/resource/SCIM_groups_role_collections 
     --> Wenn aber keine Shadow User automatisch angelegt werden --> CF API über API Endpoint --> https://docs.cloudfoundry.org/api/uaa/version/74.0.0/index.html#users
     --> gibt nur Role Collections und Shadow User vom Subaccount. Authentifizierung über XSUAA Instanz mit Plan apiaccess.
     --> Die gilt aber nur pro Subaccount --> braucht man dann pro Subaccount eine Instanz mit plan apiaccess + Service Key für die Authentifizierung
     --> Note: https://me.sap.com/notes/2760424
     --> Auth: https://api.authentication.{Landscape}.hana.ondemand.com



User #3 --> https://api.sap.com/package/authtrustmgmnt/rest

User #4 --> Cloud Foundry API --> 



# Use Case
Read all Directories and Subaccounts using CIS AccountService == OK
Read all Users of a given Subaccount ID ==> TODO
Search for users over all subaccounts ==> TODO 
Store Data in SQLite DB ==> OK
Store Data in HANA DB ==> OK

# Destination
BTP_MANAGEMENT_API (points to CIS, plan central)

# Steps
Service Instance of SAP Cloud Management Service (cis)
Service Key 
