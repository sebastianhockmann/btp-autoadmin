# Resources

https://discovery-center.cloud.sap/serviceCatalog/cloud-management-service?region=all
https://help.sap.com/docs/btp/sap-business-technology-platform/account-administration-using-apis-of-sap-cloud-management-service
https://help.sap.com/docs/btp/sap-business-technology-platform/sap-cloud-management-service-service-plans


# API
Core Services for SAP BTP - https://api.sap.com/api/APIAccountsService/overview
User #1 --> https://api.sap.com/api/IdDS_SCIM/overview



User #2 --> https://api.sap.com/api/PlatformAPI/overview
     ---> gibt nur Role Collections und Shadow User vom Subaccount. Authentifizierung über XSUAA Instanz mit Plan apiaccess.

User #3 --> https://api.sap.com/package/authtrustmgmnt/rest

User #4 --> Cloud Foundry API --> 



# Use Case
Read all Directories and Subaccounts using CIS (AccountService) == OK
Read all Users of a given Subaccount ==> TODO

# Destination
BTP_MANAGEMENT_API (points to CIS, plan central)

# Steps
Service Instance of SAP Cloud Management Service (cis)
Service Key 
