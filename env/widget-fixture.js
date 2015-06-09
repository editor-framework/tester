(function () {
    var WidgetFixturePrototype = Object.create(HTMLElement.prototype);
    var klass = {
        _fixtureTemplate: null,

        create: function ( done ) {
            this._fixtureTemplate = this.querySelector('template');

            var url = this.getAttribute('src');
            var self = this;

            if ( url ) {
                Polymer.Base.importHref( url, function ( event ) {
                    self.createFrom( self._fixtureTemplate, function ( el ) {
                        if ( el ) {
                            self.appendChild(el);
                        }
                        done(el);
                    });
                }, function ( err ) {
                    Editor.error( 'Failed to load %s. message: %s', url, err.message );
                    done();
                });
            }
            else {
                self.createFrom( self._fixtureTemplate, function ( el ) {
                    if ( el ) {
                        self.appendChild(el);
                    }
                    done(el);
                });
            }
        },

        createFrom: function ( template, done ) {
            if ( !template || template.tagName !== 'TEMPLATE' ) {
                done ();
                return;
            }

            var fixturedFragment = document.importNode(template.content, true);
            // Immediately upgrade the subtree if we are dealing with async
            // Web Components polyfill.
            // https://github.com/Polymer/polymer/blob/0.8-preview/src/features/mini/template.html#L52
            if (window.CustomElements && CustomElements.upgradeSubtree) {
                CustomElements.upgradeSubtree(fixturedFragment);
            }

            var el = fixturedFragment.firstElementChild;
            done(el);
        },

        restore: function () {
            this.removeElements(this.children);
            this.appendChild(this._fixtureTemplate);
            this.forcePolyfillAttachedStateSynchrony();
        },

        forcePolyfillAttachedStateSynchrony: function () {
            // Force synchrony in attachedCallback and detachedCallback where
            // implemented, in the event that we are dealing with the async Web
            // Components Polyfill.
            if (window.CustomElements && window.CustomElements.takeRecords) {
                window.CustomElements.takeRecords();
            }
        },

        removeElements: function (elements) {
            this.forElements(elements, function (element) {
                this.removeChild(element);
            }, this);
        },

        forElements: function (elements, iterator, context) {
            Array.prototype.slice.call(elements).forEach(iterator, context);
        },
    };

    Object.getOwnPropertyNames(klass).forEach(function (property) {
        Object.defineProperty(
            WidgetFixturePrototype,
            property,
            Object.getOwnPropertyDescriptor(klass, property)
        );
    });
    document.registerElement('widget-fixture', {
        prototype: WidgetFixturePrototype
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
