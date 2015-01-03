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
 * The Original Code is Preferences Toolbar 4.
 *
 * The Initial Developer of the Original Code is
 * Manuel Reimer <manuel.reimer@gmx.de>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Manuel Reimer <Manuel.Reimer@gmx.de>
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
// |  the contents of this file will be loaded into global context by the
// |  goprefbar.js component (goPrefBar)
// +-

const prefbarVersion = 20140928;

var PrefBranch = Components.classes["@mozilla.org/preferences-service;1"]
  .getService(Components.interfaces.nsIPrefBranch2);
var PromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
var ObserverService = Components.classes["@mozilla.org/observer-service;1"]
  .getService(Components.interfaces.nsIObserverService);
var WindowMediator = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);


// This is the context, where buttons may place global stuff.
var buttons = new Object();
// This one will be used for "realtime hotkey usage checking" in any
// hotkeyeditor in PrefBar. Hotkeys are fetched once on first browser load.
var hotkeysnapshot;
// This is set, if a new Version has been installed.
// If set, the first opened browser opens PrefBar homepage in new tab and
// unsets this flag.
var openPrefBarHP = false;

// Global Initialization function
// Called once per Mozilla Session
function Init() {
  dump("initializing PrefBar global Object");
  this.Components = Components; // Exported to be used by button observers

  // Clean up old stuff
  ClearPref("prefbar.version");
  ClearPref("extensions.prefbar.information_langfix");
  ClearPref("extensions.prefbar.updatenotify.enabled");
  ClearPref("extensions.prefbar.updatenotify.curversion");
  ClearPref("extensions.prefbar.btnrestoretab.maxcache");
  ClearPref("extensions.prefbar.display_on");
  ClearPref("extensions.prefbar.show_prefbar_menu");

  // Load submodules
  var submodules = ["RDF", "JSONUtils", "ImpExp"];
  for (var sindex = 0; sindex < submodules.length; sindex++) {
    var submodule = submodules[sindex];
    this[submodule] = {};
    Include("chrome://prefbar/content/goprefbar/" + submodule + ".js",
            this[submodule]);
    this[submodule].Init(this);
  }

  // Init observer for listening on Profile changes via "Extras ->
  // Change Profile". In this situation we have to "re-initialise" some
  // parts of PrefBar
  ProfChangeObserver.goPrefBar = this; // Reference to goPrefBar for re-init
  ObserverService.addObserver(ProfChangeObserver,"profile-after-change",false);
  // Init observer for resetting the UA string. The observer will be called
  // by mozilla if the suite is about to shutdown. Means if all browser
  // *and* all mail, composer, chat.... windows have been closed.
  ObserverService.addObserver(UAResetObserver,"quit-application",false);

  // Prefill web import whitelist
  ImportWhitelistPrefs();
}

var ProfChangeObserver = {
  observe: function(subject,topic,data){
    if (data == "switch") {
      // The user has switched the profile. At first we have to do
      // a check if PrefBar is available in the new profile
      var urlprefbar = "chrome://prefbar/content/prefbarOverlay.js";
      if (!ChromeExists(urlprefbar)) {
        dump("PrefBar: Profile changed, but no PrefBar here...");
        return;
      }

      JSONUtils.Init(this.goPrefBar);
      ImpExp.Init(this.goPrefBar);

      dump("PrefBar: Profile changed, reinitialized modules!");
    }
  }
};

var UAResetObserver = {
  observe: function(subject,topic,data){
    /* Reset the User Agent string pref when exiting the browser completely.

       This is to prevent crashes when using the Java Plugin with the UA set
       to that of IE. See mozilla bug 83376.

       As an added bonus prevents you from forgetting that you changed it and
       sending the wrong UA everywhere for three weeks.
    */

    // Don't reset if the user knows what he's doing
    if (GetPref("extensions.prefbar.don_t_reset_ua", false)) return;

    // Don't reset if there is a session to be restored on next start
    if (GetPref("browser.sessionstore.resume_session_once", false)) return;

    ClearPref("general.useragent.override");
    ClearPref("general.appname.override");
    ClearPref("general.appversion.override");
    ClearPref("general.platform.override");
  }
};

// This one imports all pref strings starting with
// "extensions.prefbar.website_import.whitelist"
// as entries of the web import whitelist.
function ImportWhitelistPrefs() {
  var list = PrefBranch.getChildList("extensions.prefbar.website_import.whitelist", {});
  for (var index = 0; index < list.length; index++) {
    var host = GetPref(list[index]);
    if (!host) continue;

    var uri = Components.classes['@mozilla.org/network/standard-url;1']
      .createInstance(Components.interfaces.nsIURI);
    uri.spec = "http://" + host;

    var pm = Components.classes["@mozilla.org/permissionmanager;1"]
      .getService(Components.interfaces.nsIPermissionManager);
    pm.add(uri, "extensions-prefbar-webimport", Components.interfaces.nsIPermissionManager.ALLOW_ACTION);

    SetPref(list[index], "");
  }
}

// Stuff for detecting in which application we are running.
// aLowerVersion and aUpperVersion for "workaround handling"
// aLowerVersion: First version where "workaround" needed
// aUpperVersion: Version where "workaround" not longer needed (fixed upstream)
function InApp(aAppID, aLowerVersion, aUpperVersion) {
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
    .getService(Components.interfaces.nsIXULAppInfo);

  if (appInfo.ID != aAppID) return false;

  var comp = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
    .getService(Components.interfaces.nsIVersionComparator);

  if (aLowerVersion && comp.compare(appInfo.version, aLowerVersion) < 0)
    return false;
  if (aUpperVersion && comp.compare(appInfo.version, aUpperVersion) >= 0)
    return false;

  return true;
}
function InSM(aLowerVersion, aUpperVersion) {
  const SM_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
  return InApp(SM_ID, aLowerVersion, aUpperVersion);
}
function InFF(aLowerVersion, aUpperVersion) {
  const FF_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
  return InApp(FF_ID, aLowerVersion, aUpperVersion);
}

function ChromeExists(chromeurl) {
  var ioservice = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);
  var chromereg = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
    .getService(Components.interfaces.nsIChromeRegistry);
  var chromeuri = ioservice.newURI(chromeurl, null, null);
  try {
    var fileuri = chromereg.convertChromeURL(chromeuri);
    var channel = ioservice.newChannelFromURI(fileuri);
    var istream = channel.open();
    var tmp = istream.available();
    istream.close();
  }
  catch (e) {
    return false;
  }
  return true;
}

function IsArray(aObject) {
  return (Object.prototype.toString.call(aObject) === "[object Array]");
}

function ArraySearch(aSearch, aArray) {
  for (var index = 0; index < aArray.length; index++)
    if (aArray[index] == aSearch) return index;
  return false;
}

function dump(aMessage) {
  if (!GetPref("extensions.prefbar.debug", false)) return;
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
  aMessage = "PrefBar debug: " + aMessage;
  consoleService.logStringMessage(aMessage);
}

function GetString(filename, stringname) {
  var StringBundle;
  var strBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);

  StringBundle = strBundleService.createBundle("chrome://prefbar/locale/" + filename);

  if (StringBundle)
    return StringBundle.GetStringFromName(stringname);

  return "";
}

// PrefBar dialog box functions
function msgYesNo(win, question, title) {
  if (!title) title = "PrefBar";
  var retval = PromptService.confirmEx(win, title, question, PromptService.STD_YES_NO_BUTTONS, null, null, null, null, {});
  return (retval == 0);
}
function msgAlert(win, alert, title) {
  if (!title) title = "PrefBar";
  PromptService.alert(win, title, alert);
}
function msgPrompt(aWin, aText, aDefault, aTitle) {
  if (!aTitle) aTitle = "PrefBar";
  var obj = new Object;
  obj.value = aDefault;
  var retval = PromptService.prompt(aWin, aTitle, aText, obj, null, {});
  return retval ? obj.value : null;
}

// Function for getting preferences
// Much like "navigator.preference" but this one
// - allows to set a default for unset prefs
// - doesn't cause silly exceptions
function GetPref(aPrefstring, aDefault) {
  var type = PrefBranch.getPrefType(aPrefstring);
  try {
    switch(type) {
    case PrefBranch.PREF_STRING:
      return PrefBranch.getCharPref(aPrefstring);
    case PrefBranch.PREF_INT:
      return PrefBranch.getIntPref(aPrefstring);
    case PrefBranch.PREF_BOOL:
      return PrefBranch.getBoolPref(aPrefstring);
    }
  } catch(e) { }
  return aDefault;
}
// This one goes with the above one and sets preferences.
function SetPref(aPrefstring, aValue) {
  switch (typeof aValue) {
  case "string":
    PrefBranch.setCharPref(aPrefstring, aValue);
    return true;
  case "number":
    PrefBranch.setIntPref(aPrefstring, aValue);
    return true;
  case "boolean":
    PrefBranch.setBoolPref(aPrefstring, aValue);
    return true;
  }
  return false;
}
// This one clears preferences
function ClearPref(aPrefstring) {
  if (PrefBranch.prefHasUserValue(aPrefstring))
    PrefBranch.clearUserPref(aPrefstring);
}


//
// external application support
//

function RunApplication(aPath, aArguments) {
  if (!IsArray(aArguments)) {
    aArguments = [aArguments];
    for (var i = 2; i < arguments.length; i++)
      aArguments.push(arguments[i])
  }

  var executable = Components.classes["@mozilla.org/file/local;1"]
    .createInstance(Components.interfaces.nsILocalFile);
  executable.initWithPath(aPath);

  if (!executable.exists()) {
    msgAlert(null, "Error - executable '" + aPath + "' not found");
    return false;
  }

  try {
    var process = Components.classes["@mozilla.org/process/util;1"]
                            .createInstance(Components.interfaces.nsIProcess);
    process.init(executable);
    process.run(false, aArguments, aArguments.length);
    return process;
  }
  catch (ex) {
    msgAlert(null, "Error - couldn't execute '" + aPath + "'");
    return false;
  }
}

//
// A function, which reads a string from clipboard.
//

function ReadClipboard(aUseSelClipboard) {
  // Prepare nsITransferable
  var trans = Components.classes["@mozilla.org/widget/transferable;1"]
                        .createInstance(Components.interfaces.nsITransferable);
  trans.addDataFlavor("text/unicode");

  // Read clipboard data to nsITransferable
  var clip = Components.classes["@mozilla.org/widget/clipboard;1"]
                       .getService(Components.interfaces.nsIClipboard);
  var cptype = clip.kGlobalClipboard;
  if (aUseSelClipboard && clip.supportsSelectionClipboard())
    cptype = clip.kSelectionClipboard;
  clip.getData(trans, cptype);

  // Get data out of nsITransferable
  var str       = new Object();
  var strLength = new Object();

  try {
    trans.getTransferData("text/unicode", str, strLength);
  } catch(e) { return false; }

  if (!str) return false;

  str = str.value.QueryInterface(Components.interfaces.nsISupportsString);
  str = str.data.substring(0, strLength.value / 2);

  // Return string with dropped spaces in front and at the end.
  return str.replace(/^\s*/, "").replace(/\s*$/, "");
}

//
// A function, which writes a string to clipboard.
//

function WriteClipboard(aText, aUseSelClipboard) {
  var str = Components.classes["@mozilla.org/supports-string;1"]
    .createInstance(Components.interfaces.nsISupportsString);
  if (!str) return false;

  str.data = aText;

  var trans = Components.classes["@mozilla.org/widget/transferable;1"]
    .createInstance(Components.interfaces.nsITransferable);
  if (!trans) return false;

  trans.addDataFlavor("text/unicode");
  trans.setTransferData("text/unicode", str, aText.length * 2);

  var clipid = Components.interfaces.nsIClipboard;
  var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
  if (!clip) return false;

  var cptype = clip.kGlobalClipboard;
  if (aUseSelClipboard && clip.supportsSelectionClipboard())
    cptype = clip.kSelectionClipboard;

  clip.setData(trans, null, cptype);
  return true;
}

//
// General stuff for toggling plugins in addon manager
//

// Used to get plugin object array from plugin manager
// May also be used to check, if Plugin manager exists
function GetPluginTags() {
  if (!("nsIPluginHost" in Components.interfaces)) return false;
  var phs = Components.classes["@mozilla.org/plugin/host;1"]
                      .getService(Components.interfaces.nsIPluginHost);
  var plugins = phs.getPluginTags({ });
  return plugins;
}
// Sets plugin enabled status of plugin(s), whose name matches on aRegEx,
// to aValue. aName is used for the "not found" message and is optional
function SetPluginEnabled(aRegEx, aValue, aName) {
  if (!aName) aName = aRegEx.toString().replace(/[^a-z ]/gi, "");
  var filenames = {};

  var plugins = GetPluginTags();
  if (!plugins) return;
  var found = false;
  for (var i = 0; i < plugins.length; i++) {
    if (plugins[i].name.match(aRegEx)) {
      if ("enabledState" in plugins[i]) { // Firefox >= 23
        var mode = GetPref("extensions.prefbar.plugintoggle.mode", 0);
        var nsIPluginTag = Components.interfaces.nsIPluginTag;
        switch(mode) {
        case 0:
          plugins[i].enabledState = aValue ? nsIPluginTag.STATE_ENABLED
                                           : nsIPluginTag.STATE_DISABLED;
          break;
        case 1:
          plugins[i].enabledState = aValue ? nsIPluginTag.STATE_CLICKTOPLAY
                                           : nsIPluginTag.STATE_DISABLED;
          break;
        case 2:
          plugins[i].enabledState = aValue ? nsIPluginTag.STATE_ENABLED
                                           : nsIPluginTag.STATE_CLICKTOPLAY;
          break;
        }
      }
      else // Firefox <= 22
        plugins[i].disabled = !aValue;

      var filename = plugins[i].filename;
      //https://www.mozdev.org/bugs/show_bug.cgi?id=22582
      if (filename in filenames)
        msgAlert(null, "You have more than one plugin with name \"" + filename + "\" on your system.\nThis may confuse PrefBar and browser.\nPlease delete all but one of them.");
      filenames[filename] = true;
      found = true;
    }
  }

  if (!found) msgAlert(null, "No " + aName + " plugin found!");
}
// Returns plugin enabled status of plugin(s), whose name matches on aRegEx
function GetPluginEnabled(aRegEx) {
  var plugins = GetPluginTags();
  if (!plugins) return false;
  for (var i = 0; i < plugins.length; i++) {
    if (plugins[i].name.match(aRegEx))
      if ("enabledState" in plugins[i]) { // Firefox >= 23
        var mode = GetPref("extensions.prefbar.plugintoggle.mode", 0);
        var nsIPluginTag = Components.interfaces.nsIPluginTag;
        switch(mode) {
        case 0:
        case 2:
          return (plugins[i].enabledState == nsIPluginTag.STATE_ENABLED);
        case 1:
          return (plugins[i].enabledState == nsIPluginTag.STATE_CLICKTOPLAY ||
                  plugins[i].enabledState == nsIPluginTag.STATE_ENABLED);
        }
      }
      else // Firefox <= 22
        return !plugins[i].disabled;
  }
  return false;
}

function GoButtonEditor(aWindow, aParam, aParam2) {
  var editWin = WindowMediator.getMostRecentWindow("prefbar:btneditor");
  if (editWin)
    editWin.focus();
  else
    aWindow.openDialog("chrome://prefbar/content/buttoneditor/editWin.xul", "editItemDialog", "chrome,titlebar,dialog,resizable,minimizable", aParam, aParam2);
}
