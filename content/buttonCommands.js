/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Preferences Toolbar 3.
 *
 * The Initial Developer of the Original Code is
 * Manuel Reimer.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Aaron Andersen <aaron@xulplanet.com>
 *                 Manuel Reimer <Manuel.Reimer@gmx.de>
 *                 Stephen Clavering <mozilla@clav.me.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// +-
// |  the contents of this file will be loaded into "PrefBarNS" namespace in
// |  browser context
// |
// |  Even if not required, all function names here should be prefixed with
// |  "prefbar" to differentiate PrefBar API functions from global browser code
// +-

// Obsoletes (moved to global "goPrefBar" context)
var prefbarExecute = goPrefBar.RunApplication;
var prefbarReadClipboard = goPrefBar.ReadClipboard;

//
// Clear cache buttons
//

function prefbarClearCache(aType) {
  var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
    .getService(Components.interfaces.nsICacheService);
  try {
    cacheService.evictEntries(aType);
  } catch (e) {}
}
function prefbarClearMemCache() {
  prefbarClearCache(Components.interfaces.nsICache.STORE_IN_MEMORY);
}
function prefbarClearDiskCache() {
  prefbarClearCache(Components.interfaces.nsICache.STORE_ON_DISK);
}
function prefbarClearAllCache() {
  prefbarClearCache(Components.interfaces.nsICache.STORE_ANYWHERE);
}

//
// Clear offline apps
//

function prefbarClearOfflineApps() {
  prefbarClearCache(Components.interfaces.nsICache.STORE_OFFLINE);

  var storageMgr = Components.classes["@mozilla.org/dom/storagemanager;1"]
    .getService(Components.interfaces.nsIDOMStorageManager);
  storageMgr.clearOfflineApps();
}

//
// Clear cookies
//

function prefbarClearCookies() {
  cookieMgr = Components.classes["@mozilla.org/cookiemanager;1"]
                        .getService(Components.interfaces.nsICookieManager);
  cookieMgr.removeAll();

  // clear any network geolocation provider sessions
  var psvc = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefService);
  try {
    var branch = psvc.getBranch("geo.wifi.access_token.");
    branch.deleteBranch("");
  } catch (e) {}
}

//
// Clear history
//

function prefbarClearHistory() {
  // use try/catch for everything but the last task so we clear as much as
  // possible
  try {
    var history = Components.classes["@mozilla.org/browser/global-history;2"]
      .getService(Components.interfaces.nsIBrowserHistory);
    history.removeAllPages();
  } catch(ex) {goPrefBar.dump("ERROR: Clear history failed");}

  try {
    var os = Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService);
    os.notifyObservers(null, "browser:purge-session-history", "");
  } catch(ex) {goPrefBar.dump("ERROR: notifyObservers failed");}
}

//
// Clear location bar
//

function prefbarClearLocationBar() {
  goPrefBar.ClearPref("general.open_location.last_url");

  // SeaMonkey 2.x only
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties)
                       .get("ProfD", Components.interfaces.nsIFile);
  file.append("urlbarhistory.sqlite");
  if (file.exists())
    file.remove(false);
}

//
// Clear form data
//

function prefbarClearFormData() {
  // Clear undo history of all searchBars (FF only)
  var wm = Components.classes['@mozilla.org/appshell/window-mediator;1']
    .getService(Components.interfaces.nsIWindowMediator);
  var windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    var searchBar = windows.getNext().document.getElementById("searchbar");
    if (searchBar)
      searchBar.textbox.reset();
  }

  formHistory = Components.classes["@mozilla.org/satchel/form-history;1"]
    .getService(Components.interfaces.nsIFormHistory2);
  formHistory.removeAllEntries();
}

//
// Clear downloads
//

function prefbarClearDownloads() {
  dlMgr = Components.classes["@mozilla.org/download-manager;1"]
    .getService(Components.interfaces.nsIDownloadManager);
  dlMgr.cleanUp();
}

//
// Clear passwords
//

function prefbarClearPasswords() {
  var pwmgr = Components.classes["@mozilla.org/login-manager;1"]
    .getService(Components.interfaces.nsILoginManager);
  pwmgr.removeAllLogins();
}

//
// Clear sessions
//

function prefbarClearSessions() {
  // clear all auth tokens (SM way)
  Components.classes["@mozilla.org/security/pk11tokendb;1"]
    .createInstance(Components.interfaces.nsIPK11TokenDB)
    .getInternalKeyToken()
    .checkPassword("");

  // clear all auth tokens (FF way)
  // try/catch to avoid possible problems on SM
  try {
    var sdr = Components.classes["@mozilla.org/security/sdr;1"]
      .getService(Components.interfaces.nsISecretDecoderRing);
    sdr.logoutAndTeardown();
  } catch(e) {}

  // clear plain HTTP auth sessions
  var authMgr = Components.classes["@mozilla.org/network/http-auth-manager;1"]
    .getService(Components.interfaces.nsIHttpAuthManager);
  authMgr.clearAll();
}


//
// Font + and Font -
//

function prefbarZoomReduce() {
  if ("FullZoom" in window)
    FullZoom.reduce();
  else
    ZoomManager.prototype.getInstance().reduce();
}
function prefbarZoomEnlarge() {
  if ("FullZoom" in window)
    FullZoom.enlarge();
  else
    ZoomManager.prototype.getInstance().enlarge();
}

//
// "Kill Flash" button
//

function prefbarKillFlash() {
  var frames = prefbarGetFrames(window._content.window);
  for (var frameindex in frames) {
    var page = frames[frameindex].document;

    // "Twice-Cooked Method" and <embed>

    var embeds = page.getElementsByTagName("embed");

    for(var i = embeds.length - 1; i >= 0; i--) {
      var current = embeds[i];

      if(current.type =="application/x-shockwave-flash") {
        if(current.parentNode.nodeName.toLowerCase() == "object")
          current = current.parentNode;
        prefbarRemoveElement(page, current);
      }
    }

    // "Satay Method" and <object>

    var objects = page.getElementsByTagName("object");

    for(var i = objects.length - 1; i >= 0; i--) {
      var current = objects[i];

      if(current.type =="application/x-shockwave-flash")
        prefbarRemoveElement(page, current);
    }
  }
}

function prefbarGetFrames(owindow) {
  var winarray = new Array();
  winarray.push(owindow);
  var len = owindow.frames.length;
  for (var index = 0; index < len; index++)
    winarray = winarray.concat(prefbarGetFrames(owindow.frames[index]));
  return winarray;
}

function prefbarRemoveElement(page, element) {
  var width = element.width;
  var height = element.height;
  if (width && height) {
    var div = page.createElement("DIV");
    var text = page.createTextNode(" ");
    div.appendChild(text);

    element.parentNode.replaceChild(div, element);

    div.setAttribute("style", "height: " + height + "px; width: " + width + "px; border: 1px solid black;");
  }
  else
    element.parentNode.removeChild(element);
}

//
// Proxy serverlist
//

function prefbarSetProxy(str) {
  if (str == "")
    goPrefBar.SetPref("network.proxy.type", 0);
  else {
    var args = str.split(":");
    var host;
    var port;

    if (args.length == 3 && args[0] == "socks") {
      host = args[1];
      port = Number(args[2]);

      goPrefBar.SetPref("network.proxy.socks", host);
      goPrefBar.SetPref("network.proxy.socks_port", port);
      goPrefBar.ClearPref("network.proxy.http");
      goPrefBar.ClearPref("network.proxy.http_port");
      goPrefBar.ClearPref("network.proxy.ssl");
      goPrefBar.ClearPref("network.proxy.ssl_port");
      goPrefBar.ClearPref("network.proxy.ftp");
      goPrefBar.ClearPref("network.proxy.ftp_port");
      goPrefBar.ClearPref("network.proxy.gopher");
      goPrefBar.ClearPref("network.proxy.gopher_port");
    }
    else if (args.length == 2) {
      host = args[0];
      port = Number(args[1]);

      goPrefBar.SetPref("network.proxy.http", host);
      goPrefBar.SetPref("network.proxy.http_port", port);
      goPrefBar.SetPref("network.proxy.ssl", host);
      goPrefBar.SetPref("network.proxy.ssl_port", port);
      goPrefBar.SetPref("network.proxy.ftp", host);
      goPrefBar.SetPref("network.proxy.ftp_port", port);
      goPrefBar.SetPref("network.proxy.gopher", host);
      goPrefBar.SetPref("network.proxy.gopher_port", port);
      goPrefBar.ClearPref("network.proxy.socks");
      goPrefBar.ClearPref("network.proxy.socks_port");
    }
    else {
      goPrefBar.msgAlert(window, 'Wrong proxy setting: "' + str + '"');
      return;
    }

    // Maybe we shouldn't set the Proxy Type to "Manual" automatically,
    // since some users may want to use "Proxy Serverlist" *and* "Proxy
    // Menulist" at once...
    goPrefBar.SetPref("network.proxy.type", 1);
  }
}

function prefbarGetProxy() {
  if (goPrefBar.GetPref("network.proxy.type") != 1)
    return "";

  if (goPrefBar.GetPref("network.proxy.socks") != "") {
    return "socks:" +
           goPrefBar.GetPref("network.proxy.socks") + ":" +
           goPrefBar.GetPref("network.proxy.socks_port");
  }

  return goPrefBar.GetPref("network.proxy.http") + ":" +
         goPrefBar.GetPref("network.proxy.http_port");
}

//
// "Pipelining" checkbox
//

function prefbarSetPipelining(value) {
  goPrefBar.SetPref("network.http.proxy.pipelining", value);
  goPrefBar.SetPref("network.http.pipelining", value);
}

function prefbarGetPipelining() {
  return (goPrefBar.GetPref("network.http.proxy.pipelining") &&
          goPrefBar.GetPref("network.http.pipelining"));
}

//
// "Resize" menulist
//

function prefbarSetResolution(value) {
  var valueArray = value.split("x");
  window.outerWidth = valueArray[0];
  window.outerHeight = valueArray[1];
}

function prefbarGetResolution() {
  return window.outerWidth + "x" + window.outerHeight;
}

//
// "Save Page" button
//

var prefbarSPFilename = null;
var prefbarSPOldGetDefaultFileName = null;
var prefbarSPGetDefaultFileName = function() {
  if (prefbarSPFilename) {
    var retval = prefbarSPFilename;
    prefbarSPFilename = null;
    return retval;
  }
  else
    return prefbarSPOldGetDefaultFileName.apply(this, arguments);
}

function prefbarSavePage() {
  var title = window._content.document.title;
  var uri = window._content.location;
  var doc = window._content.document;
  var rchar = "_";

  title = title.replace(/\/|\\|:|\*|\?|\"|<|>|\|/g, rchar);
  title = title.replace(/\s/g, rchar);
  if (title.match(new RegExp("^" + rchar + "+$"))) title = "";

  // Filename is the modified title
  prefbarSPFilename = title;

  if (!prefbarSPOldGetDefaultFileName) {
    if (window.getDefaultFileName) {
      prefbarSPOldGetDefaultFileName = window.getDefaultFileName;
      window.getDefaultFileName = prefbarSPGetDefaultFileName;
    }
    else {
      goPrefBar.msgAlert(window, "Save Page feature not available for the mozilla version you use!");
      return;
    }
  }

  // Save function used by Mozilla since 1.8 and SeaMonkey
  if (window.internalSave) {
    // We want to use cached data because the document is currently visible.
    var dispHeader = null;
    try {
      dispHeader =
        doc.defaultView
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindowUtils)
        .getDocumentMetadata("content-disposition");
    } catch (ex) {
      // Failure to get a content-disposition is ok
    }

    internalSave(uri, doc, null, dispHeader,
                 doc.contentType, false, null, null);
  }
  else
    goPrefBar.msgAlert(window, "Save Page feature not available for the mozilla version you use!");
}

//
// Useragent Menulist
// This code handles useragent, appname, appversion and platform spoofing
// If more than useragent is needed, then prefix the value with "js:"
// and use Javascript syntax to set the variables "useragent", "appname",
// "appversion" and "platform"
//

function prefbarSetUseragent(value) {
  // This are the variables that may be changed in the short Javascript
  // in menuitems value
  var useragent;
  var appname;
  var appversion;
  var platform;

  if (value.substr(0,3) == "js:")
    eval(value.substr(3));
  else {
    // XXX Hack to get backwards compatibility
    // In new PrefBar versions the default item in an list is marked by the
    // value "PREFBARDEFAULT". This allows to have the default item
    // everywhere in the list and doesn't confuse the users (see
    // PrefBar-Bug 5733) In old versions simply the first item was the
    // default. As we don't update the items of the "User Agent Menulist",
    // we have to be backwards compatible for this one item.
    if (value == "") value = undefined;

    // If value is PREFBARDEFAULT then we have to reset the preference
    if (value == "PREFBARDEFAULT") value = undefined;

    useragent = value;
  }

  // Either set or reset the variables that may be changed using the user
  // agent menulist.
  var pref = "general.useragent.override";
  if (useragent == undefined)
    goPrefBar.ClearPref(pref);
  else
    goPrefBar.SetPref(pref, useragent);
  pref = "general.appname.override";
  if (appname == undefined)
    goPrefBar.ClearPref(pref);
  else
    goPrefBar.SetPref(pref, appname);
  pref = "general.appversion.override";
  if (appversion == undefined)
    goPrefBar.ClearPref(pref);
  else
    goPrefBar.SetPref(pref, appversion);
  pref = "general.platform.override";
  if (platform == undefined)
    goPrefBar.ClearPref(pref);
  else
    goPrefBar.SetPref(pref, platform);
}

function prefbarGetUseragent(context) {
  var prefBranch = goPrefBar.PrefBranch;
  var defaultset = !prefBranch.prefHasUserValue("general.useragent.override");

  // XXX Hack to get backwards compatibility
  // In new PrefBar versions the default item in an list is marked by the
  // value "PREFBARDEFAULT". This allows to have the default item
  // everywhere in the list and doesn't confuse the users (see
  // PrefBar-Bug 5733) In old versions simply the first item was the
  // default. As we don't update the items of the "User Agent Menulist",
  // we have to be backwards compatible for this one item.
  if (defaultset) {
    var defaultexists = false;
    var len = context.items.length;
    for (var index = 0; index < len; index++) {
      if (context.items[index][1] == "PREFBARDEFAULT") {
        defaultexists = true;
        break;
      }
    }

    if (defaultexists)
      context.value = "PREFBARDEFAULT";
    else
      context.value = context.items[0][1];

    return;
  }

  var uavalue = goPrefBar.GetPref("general.useragent.override");
  var len = context.items.length;
  for (var index = 0; index < len; index++) {
    var curval = context.items[index][1];
    if (curval.substr(0,3) == "js:") {
      var useragent;
      var appname;
      var appversion;
      var platform;
      eval(curval.substr(3));
      if (useragent == uavalue) {
        context.value = curval;
        break;
      }
    }
    else {
      if (curval == uavalue) {
        context.value = curval;
        break;
      }
    }
  }
}

//
// Languages Menulist
// "Auto-Configures" using the settings done in the content languages GUI
// of the browser!
//

function prefbarSetLanguage(value) {
  var prefstr = goPrefBar.PrefBranch.getComplexValue("intl.accept_languages", Components.interfaces.nsIPrefLocalizedString).data;
  var langs = prefstr.split(/\s*,\s*/);
  var newlangs = Array(value);

  var len = langs.length;
  for (var index = 0; index < len; index++) {
    if (langs[index] != value)
      newlangs.push(langs[index]);
  }

  prefstr = newlangs.join(", ");
  goPrefBar.SetPref("intl.accept_languages", prefstr);
}

function prefbarGetLanguage(context) {
  var prefstr = goPrefBar.PrefBranch.getComplexValue("intl.accept_languages", Components.interfaces.nsIPrefLocalizedString).data;
  var langs = prefstr.split(/\s*,\s*/);

  context.items = Array();

  var len = langs.length;
  for (var index = 0; index < len; index ++) {
    context.items.push(Array(langs[index], langs[index]));
  }

  context.value = langs[0];
}

//
// Restore Tab Button
//
function prefbarRestoreTab() {
  // Call Firefox 2.0 restore tab backend, if exists.
  if (window.undoCloseTab) {
    goPrefBar.dump("prefbarRestoreTab: Calling internal 'undoCloseTab'");
    undoCloseTab();
    return;
  }

  // Call MultiZilla restore tab backend, if exists.
  if ("restoreTab" in gBrowser) {
    goPrefBar.dump("prefbarRestoreTab: Calling MultiZilla 'gBrowser.restoreTab'");
    gBrowser.restoreTab(0);
    return;
  }

  // If we get up to here, then "Restore Tab" didn't work
  goPrefBar.msgAlert(window, "Restore Tab doesn't currently work in the browser, you use.\nPlease file a bug at http://prefbar.tuxfamily.org/");
}

//
// Proxies checkbox
//

function prefbarGetProxyEnabled() {
  var type = goPrefBar.GetPref("network.proxy.type");
  return (type != 0);
}

function prefbarSetProxyEnabled(value) {
  var typepref = "network.proxy.type";
  var lasttypepref = "extensions.prefbar.btnproxycheck.lasttype";
  if (value == false) {
    var type = goPrefBar.GetPref(typepref);
    goPrefBar.SetPref(lasttypepref, type);
    goPrefBar.SetPref(typepref, 0);
  }
  else {
    var lasttype = goPrefBar.GetPref(lasttypepref, 1);
    if (lasttype == 0) lasttype = 1;
    goPrefBar.SetPref(typepref, lasttype);
  }
}

//
// Tab dependent checkboxes
//

// Javascript
function prefbarSetTabJavascript(value) {
  prefbarGetDocShell().allowJavascript = value;
}
function prefbarGetTabJavascript() {
  return prefbarGetDocShell().allowJavascript;
}
// Images
function prefbarSetTabImages(value) {
  prefbarGetDocShell().allowImages = value;
}
function prefbarGetTabImages() {
  return prefbarGetDocShell().allowImages;
}
// Plugins
function prefbarSetTabPlugins(value) {
  prefbarGetDocShell().allowPlugins = value;
}
function prefbarGetTabPlugins() {
  return prefbarGetDocShell().allowPlugins;
}
function prefbarGetDocShell() {
  var docShell = getBrowser().docShell;
  docShell.QueryInterface(Components.interfaces.nsIDocShell);
  return docShell;
}

//
// Java checkbox
//

//Java(TM) Plug-in                  <-- Linux
//IcedTea NPR Web Browser Plugin    <-- Linux (http://icedtea.classpath.org/)
//Java Embedding Plugin 0.9.7.2     <-- Mac OS X
//InnoTek OS/2 Kit for Java Plug-in <-- OS/2
//Java(TM) Platform SE 6 U16        <-- Windows
//Java Deployment Toolkit 6.0.160.1 <-- Don't match for this!
var prefbarRegExJava = /(^| )(java|icedtea).*(platform|plug-?in)/i;
function prefbarSetJava(aValue) {
  // Set both (Pref and Plugin disabled status), if possible
  goPrefBar.SetPref("security.enable_java", aValue);
  goPrefBar.SetPluginEnabled(prefbarRegExJava, aValue, "Java");
}
function prefbarGetJava() {
  return goPrefBar.GetPluginEnabled(prefbarRegExJava);
}

//
// Flash checkbox
//

var prefbarRegExFlash = /^shockwave flash/i;
function prefbarSetFlash(aValue) {
  goPrefBar.SetPluginEnabled(prefbarRegExFlash, aValue, "Flash");
}
function prefbarGetFlash() {
  return goPrefBar.GetPluginEnabled(prefbarRegExFlash);
}
