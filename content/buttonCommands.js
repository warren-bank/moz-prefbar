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

//
// Clear cache button
//

function prefbarClearAllCache() {
  var cache;

  // New interface since Firefox 32
  if ("nsICacheStorageService" in Components.interfaces) {
    cache = Components.classes["@mozilla.org/netwerk/cache-storage-service;1"]
      .getService(Components.interfaces.nsICacheStorageService);
    try {
      cache.clear();
    } catch(e) {}
  }
  else {
    cache = Components.classes["@mozilla.org/network/cache-service;1"]
      .getService(Components.interfaces.nsICacheService);
    try {
      cacheService.evictEntries(Components.interfaces.nsICache.STORE_ANYWHERE);
    } catch(e) {}
  }
}

//
// Clear offline apps
//

function prefbarClearOfflineApps() {
  // New interface since Firefox 32
  if ("nsICacheStorageService" in Components.interfaces) {
    Components.utils.import("resource:///modules/offlineAppCache.jsm");
    OfflineAppCacheHelper.clear();
  }
  else {
    var cache = Components.classes["@mozilla.org/network/cache-service;1"]
      .getService(Components.interfaces.nsICacheService);
    try {
      cacheService.evictEntries(Components.interfaces.nsICache.STORE_OFFLINE);
    } catch(e) {}

    var storageMgr = Components.classes["@mozilla.org/dom/storagemanager;1"]
      .getService(Components.interfaces.nsIDOMStorageManager);
    storageMgr.clearOfflineApps();
  }
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
    var history;
    // New interface since Firefox 22 and SeaMonkey 2.19
    if ("nsINavHistoryService" in Components.interfaces)
      history = Components.classes["@mozilla.org/browser/nav-history-service;1"]
        .getService(Components.interfaces.nsINavHistoryService)
        .QueryInterface(Components.interfaces.nsIBrowserHistory)
        .QueryInterface(Components.interfaces.nsPIPlacesDatabase);
    else
      history = Components.classes["@mozilla.org/browser/global-history;2"]
        .getService(Components.interfaces.nsIBrowserHistory);
    history.removeAllPages();
  } catch(ex) {goPrefBar.dump("ERROR: Clear history failed");}

  try {
    goPrefBar.ObserverService
      .notifyObservers(null, "browser:purge-session-history", "");
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
  var windows = goPrefBar.WindowMediator.getEnumerator("navigator:browser");
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
  // Still used by SeaMonkey 2.20 for whatever reason but obsolete for FF 26.0
  var dlMgr = Components.classes["@mozilla.org/download-manager;1"]
    .getService(Components.interfaces.nsIDownloadManager);
  if ("cleanUp" in dlMgr) dlMgr.cleanUp();

  // New interface for download history since Firefox 8.0 and SeaMonkey 2.5
  if ("nsIDownloadHistory" in Components.interfaces)
    Components.classes["@mozilla.org/browser/download-history;1"]
      .getService(Components.interfaces.nsIDownloadHistory)
      .removeAllDownloads();
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
  for (var frameindex = 0; frameindex < frames.length; frameindex++) {
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
  for (var index = 0; index < owindow.frames.length; index++)
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

function prefbarSetProxy(aValue) {
  if (aValue == "")
    goPrefBar.SetPref("network.proxy.type", 0);
  else if (aValue.match(/^(?:(\w+):)?(\[[^\]]+\]|[^:]+):(\d+)$/)) {
    goPrefBar.SetPref("network.proxy.type", 1);

    var type = RegExp.$1;
    var host = RegExp.$2;
    var port = Number(RegExp.$3);
    goPrefBar.dump("prefbarSetProxy: type: " + type + " host: " + host + " port: " + port);

    if (type == "socks") {
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
    else {
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
  }
  else
    goPrefBar.msgAlert(window, 'Wrong proxy setting: "' + aValue + '"');
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
// "Cache" checkbox
//

function prefbarSetCacheEnabled(value) {
  goPrefBar.SetPref("browser.cache.disk.enable", value);
  goPrefBar.SetPref("browser.cache.memory.enable", value);
}

function prefbarGetCacheEnabled() {
  return (goPrefBar.GetPref("browser.cache.disk.enable") &&
          goPrefBar.GetPref("browser.cache.memory.enable"));
}

//
// "Resize" menulist
//

function prefbarSetResolution(aValue) {
  var valueArray = aValue.split("x");
  if (valueArray[0]) window.outerWidth  = valueArray[0];
  if (valueArray[1]) window.outerHeight = valueArray[1];
}

function prefbarGetResolution(aItems) {
  var fullvalue = window.outerWidth + "x" + window.outerHeight;
  var wvalue = window.outerWidth + "x";
  var hvalue = "x" + window.outerHeight;

  var retval;
  for (var index = 0; index < aItems.length; index++) {
    var curval = aItems[index][1];
    if (curval == fullvalue) return curval;
    if (curval == wvalue || curval == hvalue) retval = curval;
  }
  return retval;
}

//
// Useragent Menulist
//

function prefbarSetUseragent(aValue) {
  var data = new Components.utils.Sandbox(window);
  if (aValue.substr(0,3) == "js:")
    Components.utils.evalInSandbox(aValue.substr(3), data);
  else if (aValue != "!RESET!")
    data.useragent = aValue;

  // Either set or reset the variables that may be changed using the user
  // agent menulist.
  for (var varname in {useragent:1, appname:1, appversion:1, platform:1}) {
    var pref = "general." + varname + ".override";
    if (data[varname] == undefined)
      goPrefBar.ClearPref(pref);
    else
      goPrefBar.SetPref(pref, data[varname]);
  }
}

function prefbarGetUseragent(aItems) {
  if (!goPrefBar.PrefBranch.prefHasUserValue("general.useragent.override"))
    return "!RESET!";

  var uavalue = goPrefBar.GetPref("general.useragent.override");
  for (var index = 0; index < aItems.length; index++) {
    var curval = aItems[index][1];
    var data = new Components.utils.Sandbox(window);
    if (curval.substr(0,3) == "js:")
      Components.utils.evalInSandbox(curval.substr(3), data);
    else
      data.useragent = curval;

    if (data.useragent == uavalue)
      return curval;
  }
  return undefined;
}

//
// Restore Tab Button
//
function prefbarRestoreTab() {
  if (window.undoCloseTab) { // Firefox
    goPrefBar.dump("prefbarRestoreTab: Calling Firefox 'undoCloseTab'");
    undoCloseTab();
  }
  else if (gBrowser.undoCloseTab) { // SeaMonkey >= 2.1
    goPrefBar.dump("prefbarRestoreTab: Calling SM 2.1 'gBrowser.undoCloseTab'");
    gBrowser.undoCloseTab(0);
  }
  else if (gBrowser.restoreTab) { // SeaMonkey 2.0
    goPrefBar.dump("prefbarRestoreTab: Calling SM 2.0 'gBrowser.restoreTab'");
    gBrowser.restoreTab(0);
  }
  else
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
