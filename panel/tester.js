(function () {

Editor.registerPanel( 'tester.panel', {
    is: 'editor-tester',

    properties: {
    },

    ready: function () {
    },

    _onRunnerConsole: function ( event ) {
        console.log('Runner Console: ', event.message);
    },

    _onRunnerIpc: function ( event ) {
        switch ( event.channel ) {
        case 'runner:start':
            console.log('runner start');
            break;

        case 'runner:pending':
            console.log(event);
            break;

        case 'runner:pass':
            console.log(event);
            break;

        case 'runner:fail':
            console.log(event);
            break;

        case 'runner:finish':
            console.log('runner finish');
            break;
        }
    },
});

})();
