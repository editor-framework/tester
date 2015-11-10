'use strict';

describe('Test all styles', function () {
  it('should be right', function () {
    assert.isTrue(true);
  });

  it('should report error', function () {
    assert.isTrue(false);
  });

  it('css .test.pass.fast', function (done) {
    setTimeout( function () {
      done();
    }, 10);
  });

  it('css .test.pass.medium', function (done) {
    setTimeout( function () {
      done();
    }, 50);
  });

  it('css .test.pass.slow', function (done) {
    setTimeout( function () {
      done();
    }, 100);
  });

  it('css .test.pending');
  it.skip('css .test.pending skip', function () {
  });

  it('a long looooooooong loooooooooooooooong loooooooooooooooooooog text', function (done) {
    setTimeout( function () {
      done();
    }, 50);
  });
});
