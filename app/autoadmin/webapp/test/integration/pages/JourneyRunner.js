sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/zeiss/autoadmin/test/integration/pages/SubaccountList",
	"com/zeiss/autoadmin/test/integration/pages/SubaccountObjectPage"
], function (JourneyRunner, SubaccountList, SubaccountObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/zeiss/autoadmin') + '/test/flp.html#app-preview',
        pages: {
			onTheSubaccountList: SubaccountList,
			onTheSubaccountObjectPage: SubaccountObjectPage
        },
        async: true
    });

    return runner;
});

