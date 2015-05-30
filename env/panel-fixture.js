(function () {
    // register <panel-fixture>
    var PanelFixturePrototype = Object.create(HTMLElement.prototype);
    var klass = {
        frameEL: null,
        create: function ( done ) {
            var panelID = this.getAttribute('panel-id');

            Editor.Panel.load(panelID, function ( err, frameEL ) {
                document.body.appendChild(frameEL);
                this.frameEL = frameEL;

                done(frameEL);
            }.bind(this));
        },

        restore: function () {
            // NOTE: restore can happend in both afterEach and teardown
            if ( !this.frameEL )
                return;

            var panelID = this.getAttribute('panel-id');
            document.body.removeChild(this.frameEL);
            this.frameEL = null;
            Editor.Panel.unload(panelID);
        },
    };
    Object.getOwnPropertyNames(klass).forEach(function (property) {
        Object.defineProperty(
            PanelFixturePrototype,
            property,
            Object.getOwnPropertyDescriptor(klass, property)
        );
    });
    document.registerElement('panel-fixture', {
        prototype: PanelFixturePrototype
    });

    // register mocha
    function extendInterfaceWithFixture (interfaceName) {
        var originalInterface = Mocha.interfaces[interfaceName];
        var teardownProperty = interfaceName === 'bdd' ? 'afterEach' : 'teardown';

        Mocha.interfaces[interfaceName] = function (suite) {
            originalInterface.apply(this, arguments);

            suite.on('pre-require', function (context, file, mocha) {
                if (!(context[teardownProperty])) {
                    return;
                }

                context.fixture = function (fixtureId, done) {
                    context[teardownProperty](function () {
                        document.getElementById(fixtureId).restore();
                    });

                    document.getElementById(fixtureId).create(done);
                };
            });
        };
    }
    Object.keys(Mocha.interfaces).forEach(extendInterfaceWithFixture);
})();
