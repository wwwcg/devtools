/* global __resourceQuery, __webpack_hash__ */
import webpackHotLog from './hot/log';
import parseURL from './utils/parseURL';
import socket from './socket';
import { formatProblem, show, hide } from './overlay';
import { log, setLogLevel } from './utils/log';
import reloadApp from './utils/reloadApp';
import createSocketURL from './utils/createSocketURL';
import applyReload from './utils/apply-reload';
var status = {
  // TODO Workaround for webpack v4, `__webpack_hash__` is not replaced without HotModuleReplacement
  // eslint-disable-next-line camelcase
  currentHash: typeof __webpack_hash__ !== 'undefined' ? __webpack_hash__ : ''
};
var options = {
  hot: false,
  liveReload: false,
  progress: false,
  overlay: false
};
var parsedResourceQuery = parseURL(__resourceQuery);
log.info('HMR', parsedResourceQuery);

if (parsedResourceQuery.hot === 'true') {
  options.hot = true;
  log.info('Hot Module Replacement enabled.');
}

if (parsedResourceQuery.liveReload === 'true') {
  options.liveReload = true;
  log.info('Live Reloading enabled.');
}

if (parsedResourceQuery.logging) {
  options.logging = parsedResourceQuery.logging;
}

if (typeof parsedResourceQuery.reconnect !== 'undefined') {
  options.reconnect = Number(parsedResourceQuery.reconnect);
}

function setAllLogLevel(level) {
  // This is needed because the HMR logger operate separately from dev server logger
  webpackHotLog.setLogLevel(level === 'verbose' || level === 'log' ? 'info' : level);
  setLogLevel(level);
}

if (options.logging) {
  setAllLogLevel(options.logging);
}

var onSocketMessage = {
  invalid: function invalid() {
    log.info('App updated. Recompiling...'); // Fixes #1042. overlay doesn't clear if errors are fixed but warnings remain.

    if (options.overlay) {
      hide();
    }
  },
  hash: function hash(_hash) {
    status.previousHash = status.currentHash;
    status.currentHash = _hash;
  },
  logging: setAllLogLevel,
  'progress-update': function progressUpdate(data) {
    if (options.progress) {
      log.info("".concat(data.pluginName ? "[".concat(data.pluginName, "] ") : '').concat(data.percent, "% - ").concat(data.msg, "."));
    }
  },
  'still-ok': function stillOk() {
    log.info('Nothing changed.');

    if (options.overlay) {
      hide();
    }
  },
  ok: function ok() {
    if (options.overlay) {
      hide();
    }

    reloadApp(options, status);
  },
  // TODO: remove in v5 in favor of 'static-changed'
  'content-changed': function contentChanged(file) {
    log.info("".concat(file ? "\"".concat(file, "\"") : 'Content', " from static directory was changed. Reloading..."));
    applyReload();
  },
  'static-changed': function staticChanged(file) {
    log.info("".concat(file ? "\"".concat(file, "\"") : 'Content', " from static directory was changed. Reloading..."));
    applyReload();
  },
  warnings: function warnings(_warnings, params) {
    log.warn('Warnings while compiling.');

    var printableWarnings = _warnings.map(function (error) {
      var _formatProblem = formatProblem('warning', error),
          header = _formatProblem.header,
          body = _formatProblem.body;

      return "".concat(header, "\n").concat(body);
    });

    for (var i = 0; i < printableWarnings.length; i++) {
      log.warn(printableWarnings[i]);
    }

    var needShowOverlayForWarnings = typeof options.overlay === 'boolean' ? options.overlay : options.overlay && options.overlay.warnings;

    if (needShowOverlayForWarnings) {
      show('warning', _warnings);
    }

    if (params && params.preventReloading) {
      return;
    }

    reloadApp(options, status);
  },
  errors: function errors(_errors) {
    log.error('Errors while compiling. Reload prevented.');

    var printableErrors = _errors.map(function (error) {
      var _formatProblem2 = formatProblem('error', error),
          header = _formatProblem2.header,
          body = _formatProblem2.body;

      return "".concat(header, "\n").concat(body);
    });

    for (var i = 0; i < printableErrors.length; i++) {
      log.error(printableErrors[i]);
    }

    var needShowOverlayForErrors = typeof options.overlay === 'boolean' ? options.overlay : options.overlay && options.overlay.errors;

    if (needShowOverlayForErrors) {
      show('error', _errors);
    }
  },
  error: function error(_error) {
    log.error(_error);
  },
  close: function close() {
    log.info('Disconnected!');

    if (options.overlay) {
      hide();
    }
  }
};
var socketURL = createSocketURL(parsedResourceQuery);

global.startHMR = function () {
  socket(socketURL, onSocketMessage, options.reconnect);
};
/**
 * need delay for hippy WebSocket constructor mount to global object
 * or append this entry after Hippy-Vue SDK
 */


setTimeout(function () {
  global.startHMR();
}, 1000);