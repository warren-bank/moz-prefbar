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

  // In Firefox 29 the attributes "mode" and "iconsize" are no longer supported
  if (goPrefBar.InFF("29.0")) {
    var attributes = [["mode", "icons"], ["iconsize", "small"]];
    for (var index = 0; index < attributes.length; index++) {
      var attr = attributes[index][0];
      var value = attributes[index][1];
      if (toolbar.hasAttribute(attr) && toolbar.getAttribute(attr) != value) {
        toolbar.setAttribute(attr, value);
        document.persist(toolbar.id, attr);
      }
    }
  }

  // Init hotkey stuff
  DoHotkeySnapshot();
  UpdateToggleKey();
  UpdateButtonHotkeys();

  // Toolkit dispatches event in latest browsers:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=550705
  var toolbox = document.getElementById("navigator-toolbox");
  toolbox.addEventListener("aftercustomization", OnAfterCustomization, false);

  // In older browsers, toolbar customization events are not supported.
  // Hook into the cleanup routine of toolbar customize stuff there.
  if (goPrefBar.InFF(null, "4.0") || goPrefBar.InSM(null, "2.1")) {
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
    var tab = browser.addTab("http://prefbar.tuxfamily.org/updated.html");
    browser.selectedTab = tab;
  }

  // Initialize AustralisHandler if applicable
  AustralisHandler.init();

  // Emulate a customize of the toolbox to try to init PrefBar (fails if PrefBar
  // items aren't placed to any toolbar)
  setTimeout(OnAfterCustomization, 0);
}

function Shutdown(aEvent) {
  goPrefBar.PrefBranch.removeObserver("extensions.prefbar.slimbuttons", PrefObserver);
  goPrefBar.PrefBranch.removeObserver("extensions.prefbar.hktoggle", PrefObserver);
  goPrefBar.ObserverService.removeObserver(JSONObserver, "extensions-prefbar-json-changed");

  // Uninitialize AustralisHandler if applicable
  AustralisHandler.uninit();
}

// Object for everything, needed to be compatible with Australis.
var AustralisHandler = {
  init: function() {
    if (!("CustomizableUI" in window)) return;
    CustomizableUI.addListener(this);
    this.initialized = true;
    goPrefBar.dump("AustralisHandler now initialized");

    // Register for the "click" event on PanelUI button.
    var paneluibtn = document.getElementById("PanelUI-menu-button");
    if (paneluibtn)
      paneluibtn.addEventListener("click", this.onPanelUIBtnClick, false);

    // Register for the "click" event on all known overflow buttons
    var toolbox = document.getElementById("navigator-toolbox");
    for (var index = 0; index < toolbox.children.length; index++) {
      var toolbar = toolbox.children[index];
      var overflowbtnid = toolbar.getAttribute("overflowbutton");
      if (overflowbtnid) {
        var overflowbtn = document.getElementById(overflowbtnid);
        if (overflowbtn)
          overflowbtn.addEventListener("click", function(aEvent){AustralisHandler.onOverflowBtnClick(aEvent)}, false);
      }
    }

    this.lastparent = null;
  },
  uninit: function() {
    if (!this.initialized) return;
    CustomizableUI.removeListener(this);
  },
  resize: function() {
    if (!this.initialized) return;

    // Reset lastparent if toolbaritem not on any toolbar/menu
    if (IsOnPalette("prefbar-toolbaritem")) {
      this.lastparent = null;
      return;
    }

    // Parent node changed and new parent is toolbar
    var toolbaritem = document.getElementById("prefbar-toolbaritem");
    if (toolbaritem.parentNode != this.lastparent &&
        this.GetToolbaritemContainer(toolbaritem) == "toolbar") {
      setTimeout(OnAfterCustomization, 0);
      this.lastparent = toolbaritem.parentNode;
    }
  },

  GetToolbaritemContainer: function(aToolbaritem) {
    if (!this.initialized) return false;
    var anchorid = aToolbaritem.getAttribute("cui-anchorid");
    var areatype = aToolbaritem.getAttribute("cui-areatype");
    if (!anchorid) return "toolbar";
    if (areatype == "toolbar") return "overflow";
    if (areatype == "menu-panel") return "panel";
    goPrefBar.dump("GetToolbaritemContainer: Unknown state detected!");
    return false;
  },

  onPanelUIBtnClick: function() {
    goPrefBar.dump("onPanelUIBtnClick");
    setTimeout(UpdateToolbar, 0);
  },
  onOverflowBtnClick: function(aEvent) {
    goPrefBar.dump("onOverflowBtnClick " + aEvent.target);

    // Reset lastparent if toolbaritem not on any toolbar/menu
    if (IsOnPalette("prefbar-toolbaritem")) {
      this.lastparent = null;
      return;
    }

    // Parent node changed and new parent is overflow menu
    var toolbaritem = document.getElementById("prefbar-toolbaritem");
    if (toolbaritem.parentNode != this.lastparent &&
        this.GetToolbaritemContainer(toolbaritem) == "overflow") {
      setTimeout(OnAfterCustomization, 0);
      this.lastparent = toolbaritem.parentNode;
    }
    else
      setTimeout(UpdateToolbar, 0);
  },

  hidePanelForNode: function(aNode) {
    if (!this.initialized) return;
    CustomizableUI.hidePanelForNode(aNode);
  },

  // The following ones are events, created by "CustomizableUI"
  onWidgetCreated: function(aNode) {
    goPrefBar.dump("onWidgetCreated: " + aNode.id);
  },
  onWidgetAdded: function(aNode) {
    goPrefBar.dump("onWidgetAdded: " + aNode.id);
  },
  onWidgetAfterCreation: function(aNode) {
    goPrefBar.dump("onWidgetAfterCreation: " + aNode.id);
  },
  onWidgetBeforeDOMChange: function(aNode) {
    goPrefBar.dump("onWidgetBeforeDOMChange: " + aNode.id);
  },
  onWidgetAfterDOMChange: function(aNode, aNextNode, aContainer, aIsRemoval) {
    goPrefBar.dump("onWidgetAfterDOMChange: " + aNode.id);
    if (aNode.id == "prefbar-toolbaritem" ||
        aNode.id == "prefbar-menu")
      OnAfterCustomization();
  },
  onWidgetMoved: function(aNode) {
    goPrefBar.dump("onWidgetMoved: " + aNode.id);
  },
  onWidgetDrag: function(aNodeId) {
    goPrefBar.dump("onWidgetDrag: " + aNodeId);
  }
}

var PrefObserver = {
  observe: function(aSubject, aTopic, aData) {
    switch (aData) {
    case "extensions.prefbar.slimbuttons":
      if (!IsOnPalette("prefbar-toolbaritem")) {
        var value = goPrefBar.GetPref(aData);
        var buttons = document.getElementById("prefbar-buttons");
        buttons.setAttribute("prefbarslimbuttons", value);
      }
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
  AustralisHandler.resize();
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
    // Render toolbaritem if not placed on toolbar palette
    if (!IsOnPalette("prefbar-toolbaritem")) {
      ButtonHandling.render(document.getElementById("prefbar-buttons"));
      ButtonHandling.render(document.getElementById("prefbar-chevron-popup"));
      setTimeout(UpdateToolbar);
    }
    // Render menu if not placed on toolbar palette
    if (!IsOnPalette("prefbar-menu"))
      ButtonHandling.render(document.getElementById("prefbar-menu-popup"));
    CallInitFunctions();
  }
  else
    ButtonHandling.update();

  FocusTimeStamp = new Date().getTime();
}

function OnAfterCustomization() {
  goPrefBar.dump("OnAfterCustomization");

  if (!IsOnPalette("prefbar-menu"))
    ButtonHandling.render(document.getElementById("prefbar-menu-popup"));

  var buttons;
  if (!IsOnPalette("prefbar-toolbaritem")) {
    buttons = document.getElementById("prefbar-buttons");
    ButtonHandling.render(buttons);
  }

  CallInitFunctions();

  // Cancel here, if PrefBar buttons are placed nowhere
  if (!buttons) return;

  ButtonHandling.render(document.getElementById("prefbar-chevron-popup"));

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

  // Australis: Toolbaritem on menu --> always flexible
  var container = AustralisHandler.GetToolbaritemContainer(toolbaritem);
  if (container == "overflow" || container == "panel") toolbaritem.flex = 1;

  // Set value for "slimbuttons"
  var slimvalue = goPrefBar.GetPref("extensions.prefbar.slimbuttons");
  buttons.setAttribute("prefbarslimbuttons", slimvalue);

  // Update Toolbar
  setTimeout(UpdateToolbar, 0);
}

function OnContextPopup() {
  var target = document.popupNode;
  var edititem = document.getElementById("prefbar-menuitem-edit");
  if (!target || !target.id || !gMainDS[target.id]
      || gMainDS[target.id].type == "spacer"
      || gMainDS[target.id].type == "separator") {
    edititem.hidden = true;
    return;
  }

  edititem.hidden = false;
  var template = goPrefBar.GetString("prefbarOverlay.properties", "edit-button-template");
  edititem.label = template.replace(/\$LABEL/, gMainDS[target.id].label);
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

function SetSpecialChecks(aUpdateFor) {
  if (IsOnPalette("prefbar-toolbaritem")) return;

  var buttons = document.getElementById("prefbar-buttons");

  // Loop over buttons
  for (var i = 0; i < buttons.childNodes.length; i++) {
    var button = buttons.childNodes[i];

    // Exit loop as soon as we reach the hidden buttons (chevron menu)
    if (button.style.visibility == "hidden") break;

    // Jump into toolbaritem nodes
    if (button.tagName == "toolbaritem") button = button.firstChild;

    // Get button data
    var data = gMainDS[button.id];
    if (!data) continue;

    // Check if we have to update the current button in list
    if (data.type == "link" && aUpdateFor == "page")
      ButtonHandling.link.update(button, data);
    else if (data.type == "extcheck" || data.type == "extlist") {
      var btnufor = data.browserbtnupdatefor;
      if (btnufor && (btnufor == aUpdateFor || btnufor == "page"))
        ButtonHandling[data.type].update(button, data);
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

  if (IsOnPalette("prefbar-toolbaritem")) return;

  var buttons = document.getElementById("prefbar-buttons");

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
  window.content.focus();
}

function OpenPrefs() {
  var wm = goPrefBar.WindowMediator;

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

// This function checks if the given toolbar item is not placed to any toolbar
// or one of the menus invented with Australis
function IsOnPalette(aNodeID) {
  var node = document.getElementById(aNodeID);
  if (!node) return true; // Firefox
  var parent = node.parentNode;
  if (!parent) return true;
  if (parent.tagName == "toolbarpalette") return true; // SeaMonkey
  if (parent.tagName == "toolbarpaletteitem") return true; // Firefox Australis
  return false;
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
    osrc = "prefbar://" + id.substr(15) + "/" + fname;
  }
  var omsg = "PrefBar error: " + e.message;

  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
  var scriptError = Components.classes["@mozilla.org/scripterror;1"]
    .createInstance(Components.interfaces.nsIScriptError);
  scriptError.init(omsg, osrc, null, olnum, null, 2, null);
  consoleService.logMessage(scriptError);
}
