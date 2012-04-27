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
 * The Initial Developer of the Original Code is Manuel Reimer.
 *
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Aaron Andersen <aaron@xulplanet.com>
 *                 Kevin Teuscher
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
// |  browser context (prefbarOverlay.xul)
// +-

// goPrefBar sets this to true, if anything in database has changed
var gMainDS = goPrefBar.JSONUtils.mainDS;

window.addEventListener("load", StartPrefBar, true);
window.addEventListener("unload", Shutdown, false);

function StartPrefBar(event) {
  window.removeEventListener("load", StartPrefBar, true);
  goPrefBar.dump("prefbarStartPrefBar");
  var toolbar = document.getElementById("prefbar");

  // If we are not allowed to display in Popups, then bind PrefBar to
  // the class "chromeclass-toolbar" to let the browser-backend hide it on
  // popups.
  if (!goPrefBar.GetPref("extensions.prefbar.show_in_popups"))
    toolbar.setAttribute("class", "chromeclass-toolbar");

  // Register a few event listeners
  window.addEventListener("focus", OnFocus, true); //false); FF 3.7...
  window.addEventListener("resize", OnResize, false);

  var appcontent = window.document.getElementById("appcontent");
  appcontent.addEventListener("click", OnLinkClicked, false);
  appcontent.addEventListener("DOMContentLoaded", OnPageLoaded, false);
  appcontent.addEventListener("select", OnTabChanged, false);

  // Init Pref observers
  goPrefBar.PrefBranch.addObserver("extensions.prefbar.slimbuttons", PrefObserver, false);
  goPrefBar.PrefBranch.addObserver("extensions.prefbar.hktoggle", PrefObserver, false);

  goPrefBar.ObserverService.addObserver(JSONObserver, "extensions-prefbar-json-changed", false);

  // Bugfix for Firefox. Older PrefBar versions used "goToggleToolbar" to
  // toggle the toolbar in Firefox, which used "hidden" to hide the toolbar
  if (goPrefBar.InFF() && toolbar.hidden) {
    toolbar.hidden = false;
    document.persist(toolbar.id, "hidden");
  }

  // MultiZilla support. Redraw toolbar whenever the QPrefs menu has been used
  var mztabcontextmnu = document.getElementById("tabContextMenu");
  var mzquickprefsmnu = document.getElementById("quickpref-popup");
  if (mzquickprefsmnu && mztabcontextmnu) {
    goPrefBar.dump("StartPrefbar: Registering Event Listeners for MultiZilla QPrefs");
    mztabcontextmnu.addEventListener("popuphidden", function(){setTimeout('PrefBarNS.ButtonHandling.update();');}, false);
    mzquickprefsmnu.addEventListener("popuphidden", function(){setTimeout('PrefBarNS.ButtonHandling.update();');}, false);
  }

  // Init hotkey stuff
  DoHotkeySnapshot();
  UpdateToggleKey();
  UpdateButtonHotkeys();

  // Toolkit dispatches event in latest browsers:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=550705
  var toolbox = document.getElementById("navigator-toolbox");
  toolbox.addEventListener("aftercustomization", OnAfterCustomization, false);

  // Check if browser supports dispatching above event
  var tempobj = {};
  goPrefBar.Include("chrome://global/content/customizeToolbar.js", tempobj);
  var hasevents = (typeof tempobj.dispatchCustomizationEvent == "function");
  tempobj = null;

  // If events are not supported, then hook into the cleanup routine of the
  // toolbar customize stuff
  if (!hasevents) {
    goPrefBar.dump("No customization events here.");
    if ("BrowserToolboxCustomizeDone" in window) {
      window.prefbarOrigBTCD = window.BrowserToolboxCustomizeDone;
      window.BrowserToolboxCustomizeDone = function() {
        window.prefbarOrigBTCD.apply(this, arguments);
        OnAfterCustomization();
      }
    }
    if (window.gNavToolbox && "customizeDone" in gNavToolbox) {
      gNavToolbox.prefbarOrigCD = gNavToolbox.customizeDone;
      gNavToolbox.customizeDone = function() {
        gNavToolbox.prefbarOrigCD.apply(this, arguments);
        OnAfterCustomization();
      }
    }
  }

  // In SM 2.1, SeaMonkey itself creates a menu item in View -> Toolbars
  // We keep this autogenerated one and drop the one created by our overlay
  if (goPrefBar.InSM("2.1")) {
    var menu = document.getElementById("viewprefsbar");
    if (menu) menu.parentNode.removeChild(menu);
  }

  // If the "openPrefBarHP" flag is set, then do so and unset flag.
  if (goPrefBar.openPrefBarHP) {
    goPrefBar.openPrefBarHP = false;
    var browser = getBrowser();
    var tab = browser.addTab("http://prefbar.tuxfamily.org/#news");
    browser.selectedTab = tab;
  }

  // Emulate a customize of the toolbox to try to init PrefBar (fails if PrefBar
  // items aren't placed to any toolbar)
  setTimeout(OnAfterCustomization, 0);
}

function Shutdown(aEvent) {
  goPrefBar.PrefBranch.removeObserver("extensions.prefbar.slimbuttons", PrefObserver);
  goPrefBar.PrefBranch.removeObserver("extensions.prefbar.hktoggle", PrefObserver);
  goPrefBar.ObserverService.removeObserver(JSONObserver, "extensions-prefbar-json-changed");
}

var PrefObserver = {
  observe: function(aSubject, aTopic, aData) {
    switch (aData) {
    case "extensions.prefbar.slimbuttons":
      var value = goPrefBar.GetPref(aData);
      var buttons = document.getElementById("prefbar-buttons");
      if (buttons) buttons.setAttribute("prefbarslimbuttons", value);
      break;
    case "extensions.prefbar.hktoggle":
      UpdateToggleKey();
      break;
    }
  }
};

var DatabaseChanged = false;
var JSONObserver = {
  observe: function(aSubject, aTopic, aData) {
    DatabaseChanged = true;
  }
};

function OnResize(aEvent) {
  // Resize events should not be handled for descendant nodes.
  if (aEvent.target != aEvent.currentTarget) return;

  goPrefBar.dump("OnResize");
  UpdateToolbar();
}


var FocusTimeStamp = 0;
function OnFocus(event) {
  // Prefilter: Seems to work for FF 3.5, 3,7 and SM 1.x
  if (event.target != document && event.target != window.content) {
    goPrefBar.dump("OnFocus: ignored: bad target");
    return;
  }

  // Filter: Drops calls, coming too close
  var elapsed = new Date().getTime() - FocusTimeStamp;
  if (elapsed < 1000) {
    goPrefBar.dump("OnFocus: ignored. Time diff: " + elapsed);
    FocusTimeStamp = new Date().getTime();
    return;
  }

  goPrefBar.dump("OnFocus");

  if (DatabaseChanged) {
    DatabaseChanged = false;
    // Update the hotkeys first, to be sure the right keys
    // are displayed in menus
    UpdateButtonHotkeys();
    // Now update anything else...
    var buttons = document.getElementById("prefbar-buttons");
    if (buttons) {
      ButtonHandling.render(buttons);
      var chevron = document.getElementById("prefbar-chevron-popup");
      ButtonHandling.render(chevron);
      setTimeout(UpdateToolbar);
    }
    var menu = document.getElementById("prefbar-menu-popup");
    if (menu) ButtonHandling.render(menu);
    CallInitFunctions();
  }
  else
    ButtonHandling.update();

  FocusTimeStamp = new Date().getTime();
}

function OnAfterCustomization() {
  goPrefBar.dump("OnAfterCustomization");

  var pbmenupopup = document.getElementById("prefbar-menu-popup");
  if (pbmenupopup) ButtonHandling.render(pbmenupopup);

  var buttons = document.getElementById("prefbar-buttons");
  if (buttons) ButtonHandling.render(buttons);

  CallInitFunctions();

  // Cancel here, if PrefBar buttons are placed nowhere in FF
  if (!buttons) return;

  var chevron = document.getElementById("prefbar-chevron-popup");
  ButtonHandling.render(chevron);

  // If there are other flexible items on the toolbar, we have been placed to,
  // then make PrefBar's stuff *non-flexible*
  var toolbaritem = document.getElementById("prefbar-toolbaritem");
  toolbaritem.flex = 1;
  var toolbar = toolbaritem.parentNode;
  for (var index = toolbar.childNodes.length - 1; index >= 0; index--) {
    var curitem = toolbar.childNodes[index];
    if (curitem == toolbaritem) continue;
    if (curitem.hidden || curitem.collapsed) continue;
    if (curitem.flex > 0) {
      toolbaritem.flex = 0;
      break;
    }
  }

  // Set value for "slimbuttons"
  var slimvalue = goPrefBar.GetPref("extensions.prefbar.slimbuttons");
  buttons.setAttribute("prefbarslimbuttons", slimvalue);

  // Update Toolbar
  UpdateToolbar();
}

function OnLinkClicked(event) {
  // Don't trust synthetic events
  if (!event.isTrusted) return true;

  if (!goPrefBar.GetPref("extensions.prefbar.website_import")) return true;

  var node = event.originalTarget;
  if (!node.getAttribute) return true;
  if (!node.hasAttribute("href")) return true;
  var tagname = node.nodeName.toLowerCase();
  var href = node.getAttribute("href");
  if (tagname == "a" && href.indexOf("prefbar://") == 0 && event.button < 2) {
    goPrefBar.dump("PrefBar: Link click " + href);
    window.openDialog("chrome://prefbar/content/urlimport.xul",
                      "prefbarURLImport",
                      "chrome,centerscreen,modal,titlebar",
                      href);

    event.stopPropagation();
    event.preventDefault();
    return false;
  }
  return true;
}

function OnPageLoaded(event) {
  goPrefBar.dump("OnPageLoaded");
  SetSpecialChecks("page");
}

var LastTab = null;
function OnTabChanged(event) {
  var curtab = gBrowser.mCurrentTab;
  if (LastTab == curtab) {
    goPrefBar.dump("OnTabChanged: ignored");
    return;
  }
  goPrefBar.dump("OnTabChanged");
  LastTab = curtab;

  SetSpecialChecks("tab");
}

function SetSpecialChecks(updatefor) {
  var buttons = document.getElementById("prefbar-buttons");
  if (!buttons) return;

  for (var i = 0; i < buttons.childNodes.length; i++) {
    var button = buttons.childNodes[i];

    if (button.style.visibility == "hidden") break;

    if (button.tagName == "toolbaritem") button = button.firstChild;

    var data = gMainDS[button.id];
    if (!data) continue;

    var btnufor = data.browserbtnupdatefor;
    if (!btnufor) continue;
    if (updatefor == "page" && btnufor != "page") continue;

    var btntype = data.type;

    switch (btntype) {
    case "extcheck":
      ButtonHandling.extcheck.update(button, data);
      break;
    case "extlist":
      ButtonHandling.extlist.update(button, data);
      break;
    }
  }
}


function DoHotkeySnapshot() {
  // already filled? Then don't waste CPU time again
  if (goPrefBar.hotkeysnapshot) return;

  goPrefBar.hotkeysnapshot = new Array();
  var keys = document.getElementsByTagName("key");
  for (var keyindex = 0; keyindex < keys.length; keyindex++) {
    var curkey = keys[keyindex];
    var modifier = curkey.getAttribute("modifiers");
    var key = curkey.getAttribute("key");
    if (key) key = key.toUpperCase();
    var keycode = curkey.getAttribute("keycode");
    if (keycode) keycode = keycode.toUpperCase();
    if (modifier) {
      var modarray = modifier.split(",");
      modarray.sort();
      for (var modindex = 0; modindex < modarray.length; modindex++) {
        var modkey = modarray[modindex]
          modkey = modkey.replace(/(^\s*)|(\s*$)/, "");
        if (modkey == "control") modkey = "accel";
        modarray[modindex] = modkey;
      }
      modifier = modarray.join(",");
    }
    var s = key + "\t" + keycode + "\t" + modifier;
    goPrefBar.hotkeysnapshot[s] = true;
  }
}

function UpdateToggleKey() {
  var mainwin = document.getElementById("main-window");
  var ourkeyset = document.getElementById("prefbarHKKeyset");

  if (ourkeyset)
    mainwin.removeChild(ourkeyset);

  var ourkeyset = document.createElement("keyset");
  ourkeyset.id = "prefbarHKKeyset";

  var hkstr = goPrefBar.GetPref("extensions.prefbar.hktoggle");
  var hkarr = hkstr.split("][");
  if (hkarr.length != 3)
    return;
  var vmodifiers = hkarr[0];
  var vkey = hkarr[1];
  var vkeycode = hkarr[2];

  // Only create the key, if the user enabled it (values are valid)
  if (vkey != "" || vkeycode != "") {
    var togglekey = document.createElement("key");
    togglekey.id= "key_prefbar";
    if (vmodifiers != "")
      togglekey.setAttribute("modifiers", vmodifiers);
    if (vkey != "")
      togglekey.setAttribute("key", vkey);
    if (vkeycode != "")
      togglekey.setAttribute("keycode", vkeycode);
    togglekey.setAttribute("command", "cmd_prefbar");
    ourkeyset.appendChild(togglekey);
  }

  mainwin.appendChild(ourkeyset);

  var menuitem = document.getElementById("viewprefsbar");
  if (menuitem) menuitem.removeAttribute("acceltext");
}

function UpdateButtonHotkeys() {
  var mainwin = document.getElementById("main-window");
  var ourkeyset = document.getElementById("prefbarButtonKeyset");

  if (ourkeyset)
    mainwin.removeChild(ourkeyset);

  ourkeyset = document.createElement("keyset");
  ourkeyset.id = "prefbarButtonKeyset";
  AddButtonHotkeys(ourkeyset);
  mainwin.appendChild(ourkeyset);
}
function AddButtonHotkeys(aKeyset, aParentMenu) {
  if (!aParentMenu) aParentMenu = "prefbar:menu:enabled";

  var items = gMainDS[aParentMenu].items;
  for (var index = 0; index < items.length; index++) {
    var itemid = items[index];
    var item = gMainDS[itemid];

    if (item.type == "submenu")
      AddButtonHotkeys(aKeyset, itemid);
    else if (item.hkkey || item.hkkeycode) {
      var key = document.createElement("key");
      key.setAttribute("id", "key:" + itemid);
      if (item.hkkey) key.setAttribute("key", item.hkkey);
      if (item.hkkeycode) key.setAttribute("keycode", item.hkkeycode);
      if (item.hkmodifiers) key.setAttribute("modifiers", item.hkmodifiers);
      key.setAttribute("oncommand", "PrefBarNS.ButtonHandling.hotkey(this);");
      aKeyset.appendChild(key);
    }
  }
}

// This one will init all currently available buttons.
function CallInitFunctions(aParent) {
  if (!aParent) aParent = "prefbar:menu:enabled";

  var ds = goPrefBar.JSONUtils.mainDS;

  for (var index = 0; index < ds[aParent].items.length; index++) {
    var id = ds[aParent].items[index];
    var btn = ds[id];

    if (btn.type == "submenu")
      CallInitFunctions(id);
    else if (btn.type == "extcheck" ||
             btn.type == "extlist" ||
             btn.type == "button") {
      if (btn.initfunction) {
        try {
          var lf = new Error();
          eval(btn.initfunction);
        } catch(e) {LogError(e, lf, id, 'initfunction');}
      }
    }
  }
}

function UpdateToolbar() {
  goPrefBar.dump("UpdateToolbar");

  var buttons = document.getElementById("prefbar-buttons");
  if (!buttons) return;

  // Force to redraw everything as we need the button width.
  ButtonHandling.update(buttons, true);

  var chevron = document.getElementById("prefbar-chevron");
  var toolbaritem = document.getElementById("prefbar-toolbaritem");

  // generating toolbars with zero width is wasted CPU time!
  if (buttons.boxObject.width == 0) return;

  if (!buttons.firstChild) {
    // No buttons means no chevron
    chevron.collapsed = true;
    return;
  }

  // Hide chevron --> Button container expands to full width.
  chevron.collapsed = true;
  // If we have a flexible toolbaritem and buttons overflow, then show chevron.
  if (toolbaritem.flex != 0 && (buttons.getBoundingClientRect().right < buttons.lastChild.getBoundingClientRect().right)) {
    chevron.collapsed = false;
  }

  // Loop over buttons and set visibility.
  for (var i = 0; i < buttons.childNodes.length; i++) {
    var button = buttons.childNodes[i];
    if (toolbaritem.flex == 0)
      button.style.visibility = "visible";
    else {
      if (button.tagName == "toolbarspacer") continue;

      var remainingWidth = buttons.getBoundingClientRect().right -
                           button.getBoundingClientRect().right;

      button.style.visibility = (remainingWidth < 0) ? "hidden" : "visible";
    }
  }

  // HACK: SeaMonkey 2.0.x doesn't correctly set width of our scrollbox
  //       if toolbaritem is *not* flexible. Fixed since 2.1
  if (goPrefBar.InSM("2.0", "2.1")) {
    if (toolbaritem.flex == 0) {
      var fb = buttons.firstChild.boxObject;
      var lb = buttons.lastChild.boxObject;
      var width = lb.x - fb.x + lb.width;
      if (width != buttons.boxObject.width) {
        goPrefBar.dump("scrollbox width fixing hack in affect!");
        buttons.style.width = width + "px";
      }
    }
  }
}


function UpdateChevronMenu() {
  goPrefBar.dump("UpdateChevronMenu");

  var toolbar = document.getElementById("prefbar-buttons");
  var menu = document.getElementById("prefbar-chevron-popup");

  ButtonHandling.update(menu);

  var spacercount = 0;

  for (var i = 0; i < toolbar.childNodes.length; i++) {
    var button = toolbar.childNodes[i];
    if (button.tagName == "toolbarspacer") {
      spacercount++;
      continue;
    }
    var menuitem = menu.childNodes[i - spacercount];
    menuitem.hidden = (button.style.visibility != "hidden");
  }
}


var NotifyIndex = 0;
function OSDMessage(message) {
  const ourvalue = "prefbar-notification";
  var ourindex = NotifyIndex;
  NotifyIndex++;
  var box = getBrowser().getNotificationBox();

  // Place a new notification
  var newnotify = box.appendNotification("PrefBar: " + message,
                                         ourvalue + ourindex,
                                         null,
                                         box.PRIORITY_INFO_HIGH,
                                         null);

  // If the notification, which came before this one, is still there, then
  // drop it
  var lastnotify = box.getNotificationWithValue(ourvalue + (ourindex - 1));
  if (lastnotify) box.removeNotification(lastnotify);

  // Set a timeout of one second, where this notification is automatically
  // dropped
  setTimeout(function() {
    var toremove = box.getNotificationWithValue(ourvalue + ourindex);
    if (toremove) box.removeNotification(toremove);
  }, 1000);
}

function GoLink(url, event) {
  var pref_opentab = goPrefBar.GetPref("browser.tabs.opentabfor.middleclick");
  var pref_openwindow = goPrefBar.GetPref("middlemouse.openNewWindow");
  var pref_tabbackground = goPrefBar.GetPref("browser.tabs.loadInBackground");
  var browser = window.document.getElementById("content");

  if (!event) {
    browser.loadURI(url);
    window.content.focus();
  }
  else {
    if (event.shiftKey) pref_tabbackground = !pref_tabbackground;

    var middleClick = true;
    if (event.type == "command" && !event.ctrlKey && !event.metaKey)
      middleClick = false;

    if (!middleClick) {
      browser.loadURI(url);
      window.content.focus();
    }
    else {
      if (pref_opentab) {
        var tab = browser.addTab(url);
        if (!pref_tabbackground)
          browser.selectedTab = tab;
      } else if (pref_openwindow)
        window.open(url);
    }
  }
}

function TogglePrefBar() {
  if (goPrefBar.InFF()) {
    var prefbar = document.getElementById("prefbar");
    prefbar.collapsed = !prefbar.collapsed;
    document.persist("prefbar", "collapsed");
  }
  else
    goToggleToolbar('prefbar','viewprefsbar');
  UpdateToolbar();
  window.content.focus();
}

function OpenPrefs() {
  var wm = Components.classes['@mozilla.org/appshell/window-mediator;1']
                     .getService(Components.interfaces.nsIWindowMediator);

  var editWin = wm.getMostRecentWindow("prefbar:btneditor");
  if (editWin) {
    editWin.focus();
    return;
  }

  if (goPrefBar.InFF()) {
    var prefWin = wm.getMostRecentWindow("prefbar:preferences");
    if (prefWin)
      prefWin.focus();
    else
      openDialog('chrome://prefbar/content/prefbar-bird-pref.xul',
                 'PrefBar',
                 'chrome,titlebar,toolbar');
  }
  else
    goPreferences('prefbar_editbar_pane');
}

function LogError(e, lf, id, fname) {
  // Nothing to display for us. Let the internal error management do the job
  if (!e.message) {
    throw(e);
    return;
  }

  var olnum = e.lineNumber;
  // SeaMonkey has "fileName", Firefox has "filename"
  var osrc = e.fileName ? e.fileName : e.filename;
  if (osrc && osrc.match(/(prefbarOverlay|buttonhandling)\.js/)) {
    olnum = e.lineNumber - lf.lineNumber;
    osrc = "'" + fname + "' in button '" + id.substr(15) + "'";
  }
  var omsg = "PrefBar error: " + e.message;

  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
  var scriptError = Components.classes["@mozilla.org/scripterror;1"]
    .createInstance(Components.interfaces.nsIScriptError);
  scriptError.init(omsg, osrc, null, olnum, null, 2, null);
  consoleService.logMessage(scriptError);
}
