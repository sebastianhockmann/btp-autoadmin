sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"autoadminconfig/test/integration/pages/DestinationMappingsList",
	"autoadminconfig/test/integration/pages/DestinationMappingsObjectPage"
], function (JourneyRunner, DestinationMappingsList, DestinationMappingsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('autoadminconfig') + '/test/flp.html#app-preview',
        pages: {
			onTheDestinationMappingsList: DestinationMappingsList,
			onTheDestinationMappingsObjectPage: DestinationMappingsObjectPage
        },
        async: true
    });

    return runner;
});

