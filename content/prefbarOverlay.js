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
var DatabaseChanged = false;

window.addEventListener("load", StartPrefBar, true);

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
    mztabcontextmnu.addEventListener("popuphidden", function(){setTimeout('PrefBarNS.SetChecks(false, false)');}, false);
    mzquickprefsmnu.addEventListener("popuphidden", function(){setTimeout('PrefBarNS.SetChecks(false, false)');}, false);
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

  // If the "openPrefBarHP" flag is set, then do so and unset flag.
  if (goPrefBar.openPrefBarHP) {
    goPrefBar.openPrefBarHP = false;
    var browser = getBrowser();
    var tab = browser.addTab("http://prefbar.tuxfamily.org/#news");
    browser.selectedTab = tab;
  }

  // Emulate a customize of the toolbox to try to init PrefBar (fails if PrefBar
  // items aren't placed to any toolbar)
  OnAfterCustomization();
}

// preferences observer "driven" by goPrefBar
function PrefObserver(subject, topic, data) {
  var value;
  switch (data) {
  case "extensions.prefbar.slimbuttons":
    value = goPrefBar.GetPref(data);
    var buttons = document.getElementById("prefbar-buttons");
    if (buttons) buttons.setAttribute("prefbarslimbuttons", value);
    break;
  case "extensions.prefbar.hktoggle":
    UpdateToggleKey();
    break;
  }
}

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
      buttons.builder.rebuild();
      document.getElementById("prefbar-chevron-popup").builder.rebuild();
      setTimeout(UpdateToolbar);
    }
    var menu = document.getElementById("prefbar-menu-popup");
    if (menu) menu.builder.rebuild();
    CallInitFunctions();
  }
  else
    SetChecks(false, false);

  FocusTimeStamp = new Date().getTime();
}

function OnAfterCustomization() {
  goPrefBar.dump("OnAfterCustomization");

  var pbmenupopup = document.getElementById("prefbar-menu-popup");
  if (pbmenupopup) goPrefBar.RDF.AddmDatasource(pbmenupopup);

  var buttons = document.getElementById("prefbar-buttons");
  if (buttons) goPrefBar.RDF.AddmDatasource(buttons);

  CallInitFunctions();

  // Cancel here, if PrefBar buttons are placed nowhere in FF
  if (!buttons) return;

  var chevron = document.getElementById("prefbar-chevron-popup");
  goPrefBar.RDF.AddmDatasource(chevron);

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

  var len = buttons.childNodes.length;
  for (var i = 0; i < len; i++) {
    var button = buttons.childNodes[i];

    if (button.collapsed == true) break;

    var btnufor = button.getAttribute("browserbtnupdatefor");
    if (!btnufor) continue;
    if (updatefor == "page" && btnufor != "page") continue;

    var btntype = button.getAttribute('btntype');

    switch (btntype) {
    case "extcheck":
      SetExtcheck(button, false);
      break;
    case "extlist":
      SetExtlist(button.menupopup, false);
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
  menuitem.removeAttribute("acceltext");
}

function UpdateButtonHotkeys() {
  var mainwin = document.getElementById("main-window");
  var ourkeyset = document.getElementById("prefbarButtonKeyset");

  if (ourkeyset)
    mainwin.removeChild(ourkeyset);

  ourkeyset = document.createElement("keyset");
  ourkeyset.id = "prefbarButtonKeyset";

  ourkeyset.setAttribute("template", "prefbarHotkeyTemplate");
  ourkeyset.setAttribute("datasources", "rdf:null");
  ourkeyset.setAttribute("ref", "urn:prefbar:browserbuttons:enabled");
  ourkeyset.setAttribute("flags", "dont-test-empty");
  mainwin.appendChild(ourkeyset);

  goPrefBar.RDF.AddmDatasource(ourkeyset);
  ourkeyset.builder.rebuild();

  PrefixSubIds(ourkeyset, "key:");

  // keysets aren't properly initialised, when rendered using RDF rules
  var len = ourkeyset.childNodes.length;
  for (var cindex = 0; cindex < len; cindex++) {
    var curChild = ourkeyset.childNodes[cindex];
    if (curChild.tagName == "keyset") {
      var keyset = curChild.cloneNode(true);
      ourkeyset.insertBefore(keyset, curChild);
      ourkeyset.removeChild(curChild);
    }
  }
}
function PrefixSubIds(parent, prefix) {
  var len = parent.childNodes.length;
  for (var cindex = 0; cindex < len; cindex++) {
    var curChild = parent.childNodes[cindex];
    var curid = curChild.id;
    if (curid && curid.substr(0, prefix.length) != prefix)
      curChild.id = prefix + curid;
    if (curChild.childNodes.length > 0)
      PrefixSubIds(curChild, prefix);
  }
}

// This one will init all currently available buttons.
function CallInitFunctions(aParent) {
  var RDF = goPrefBar.RDF;
  var mainDS = RDF.mDatasource;

  if (!aParent) aParent = "urn:prefbar:browserbuttons:enabled";

  var children = RDF.GetChildNodes(mainDS, aParent);
  var len = children.length;
  for (var cindex = 0; cindex < len; cindex++) {
    var node = children[cindex];
    if (RDF.IsContainer(mainDS, node))
      CallInitFunctions(node);
    else {
      var initfunction = RDF.GetAttributeValue(mainDS, node, RDF.NC + "initfunction");
      if (initfunction) {
        var btnid = node.Value;
        try {
          var lf = new Error();
          eval(initfunction.Value);
        } catch(e) {LogError(e, lf, btnid, 'initfunction');}
      }
    }
  }
}

function UpdateToolbar() {
  // Force to redraw everything as we need the button width.
  SetChecks(false, true);

  goPrefBar.dump("UpdateToolbar");

  var buttons = document.getElementById("prefbar-buttons");
  if (!buttons) return;
  var chevron = document.getElementById("prefbar-chevron");
  var toolbaritem = document.getElementById("prefbar-toolbaritem");

  // generating toolbars with zero width is wasted CPU time!
  if (buttons.boxObject.width == 0) return;

  if (!buttons.firstChild) {
    // No buttons means no chevron
    chevron.collapsed = true;
    return;
  }

  chevron.collapsed = false; // If collapsed, we can't get width value
  var chevronWidth = chevron.boxObject.width;
  chevron.collapsed = true;

  var scrollboxRight = buttons.getBoundingClientRect().right;

  var overflowed = false;

  var len = buttons.childNodes.length;
  for (var i = 0; i < len; i++) {
    var button = buttons.childNodes[i];
    if (toolbaritem.flex == 0)
      button.style.visibility = "visible";
    else {
      if (i == buttons.childNodes.length - 1)
        chevronWidth = 0;

      if (button.tagName == "toolbarspacer") continue;

      var remainingWidth = scrollboxRight - button.getBoundingClientRect().right;

      if (!overflowed) overflowed = (remainingWidth < chevronWidth);

      button.style.visibility = overflowed ? "hidden" : "visible";
    }
  }

  chevron.collapsed = !overflowed;

  // HACK: SeaMonkey 2.0.x doesn't correctly set width of our scrollbox
  //       if toolbaritem is *not* flexible
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


function UpdateChevronMenu() {
  goPrefBar.dump("UpdateChevronMenu");

  SetChecks(true, false);

  var toolbar = document.getElementById("prefbar-buttons");
  var menu = document.getElementById("prefbar-chevron-popup");
  var spacercount = 0;

  var len = toolbar.childNodes.length;
  for (var i = 0; i < len; i++) {
    var button = toolbar.childNodes[i];
    if (button.tagName == "toolbarspacer") {
      spacercount++;
      continue;
    }
    var menuitem = menu.childNodes[i - spacercount];
    menuitem.hidden = (button.style.visibility != "hidden");
  }
}

function SetChecks(menu, forceAll, optional_target) {
  goPrefBar.dump("SetChecks Menu:" + !!menu);

  var buttons;

  if (optional_target != undefined)
    buttons = optional_target;
  else {
    if (!menu)
      buttons = document.getElementById("prefbar-buttons");
    else
      buttons = document.getElementById("prefbar-chevron-popup");
  }

  if (!buttons) return;
  var len = buttons.childNodes.length;
  for (var i = 0; i < len; i++) {

    var button = buttons.childNodes[i];
    if (!forceAll && button.style.visibility == "hidden") {
      goPrefBar.dump("SetChecks: jumpingbutton");
      break;
    }
    // Silently jump over "toolbaritem" items
    if (button.tagName == "toolbaritem") button = button.firstChild;
    var btntype = button.getAttribute('btntype');

    switch (btntype) {
    case "check":
      SetCheck(button, menu);
      break;
    case "extcheck":
      SetExtcheck(button, menu);
      break;
    case "menulist":
      if (!menu) SetMenulist(button.menupopup, false);
      break;
    case "extlist":
      if (!menu) SetExtlist(button.menupopup, false);
      break;
    }
  }
}

function ProcessButton(button, event) {
  try {
    var lf = new Error();
    eval(button.getAttribute("oncommandval"));
  } catch(e) { LogError(e, lf, button.id, "onclick"); }
}

function SetCheck(button, menu) {
  // Value is magic variable referenced in prefstring
  var value = goPrefBar.GetPref(button.getAttribute("prefstring"));

  var checked = eval(button.getAttribute("frompref"));

  if (!menu)
    button.setAttribute("checked", checked);
  else {
    var tvalue = checked ? "checkbox" : "radio";
    button.setAttribute("type", tvalue);
    button.setAttribute("checked", "true");
  }
}

function ProcessCheck(button, menu) {
  var value;
  if (!menu)
    value = button.checked;
  else
    value = (button.getAttribute("type") == "radio");

  goPrefBar.SetPref(button.getAttribute("prefstring"), eval(button.getAttribute("topref")));
}

function HotkeyCheck(key) {
  var value = goPrefBar.GetPref(key.getAttribute("prefstring"));
  var checked = eval(key.getAttribute("frompref"));
  value = !checked;
  value = eval(key.getAttribute("topref"));
  goPrefBar.SetPref(key.getAttribute("prefstring"), value);

  var msg;
  if (!checked)
    msg = goPrefBar.GetString("prefbarOverlay.properties", "enabled");
  else
    msg = goPrefBar.GetString("prefbarOverlay.properties", "disabled");
  OSDMessage(key.getAttribute("label") + ": " + msg);
  SetChecks(false, false);
}

function SetExtcheck(button, menu) {
  var func = button.getAttribute("getfunction");

  var value;
  try {
    var lf = new Error();
    eval(func);
  } catch(e) { LogError(e, lf, button.id, "getfuntion"); }

  if (!menu)
    button.setAttribute("checked", value);
  else {
    var tvalue = value ? "checkbox" : "radio";
    button.setAttribute("type", tvalue);
    button.setAttribute("checked", "true");
  }
}

function ProcessExtcheck(button, menu, event) {
  var func = button.getAttribute("setfunction");

  var value;
  if (!menu)
    value = button.checked;
  else
    value = (button.getAttribute("type") == "radio");

  try {
    var lf = new Error();
    eval(func);
  } catch(e) { LogError(e, lf, button.id, "setfuntion"); }
}

function HotkeyExtcheck(key) {
  var value;
  eval(key.getAttribute("getfunction"));
  value = !value;
  eval(key.getAttribute("setfunction"));

  var msg;
  if (value)
    msg = goPrefBar.GetString("prefbarOverlay.properties", "enabled");
  else
    msg = goPrefBar.GetString("prefbarOverlay.properties", "disabled");
  OSDMessage(key.getAttribute("label") + ": " + msg);
  SetChecks(false, false);
}


function SetMenulist(menupopup, menu) {
  var prefstring = menupopup.getAttribute("prefstring");

  var prefBranch = goPrefBar.PrefBranch;
  var prefHasUserValue = prefBranch.prefHasUserValue(prefstring);

  var prefvalue = String(goPrefBar.GetPref(prefstring));

  var items = GetMenupopupItems(menupopup);
  GenerateMenupopup(menupopup, menu, items, !prefHasUserValue, prefvalue);
}

function ProcessMenulist(menupopup, aEvent) {
  var menuitem = aEvent.target;
  var prefBranch = goPrefBar.PrefBranch;

  var pref = menuitem.parentNode.getAttribute("prefstring");
  var value = menuitem.getAttribute("value");
  var type = prefBranch.getPrefType(pref);

  if (value == "PREFBARDEFAULT")
    goPrefBar.ClearPref(pref);
  else {
    if(type == prefBranch.PREF_STRING)
      prefBranch.setCharPref(pref, value);
    else if(type == prefBranch.PREF_INT)
      prefBranch. setIntPref(pref, Number(value));
    else if(type == prefBranch.PREF_BOOL)
      prefBranch.setBoolPref(pref, Boolean(value));
    else
      navigator.preference(pref, value);  // Couldn't hurt to try...
  }
}


function SetExtlist(menupopup, menu) {
  var getfunction = menupopup.getAttribute("getfunction");

  // The variables that may be modified by the getfunction
  /* value to select in list */
  var value = "";
  /* Here we have the array of all items defined via GUI. The array has
     two dimensions. First is the index and second is label(0) and value(1)
     feel free to edit,read,parse special values or dump new items in here
     from wherever you read them */
  var items = GetMenupopupItems(menupopup);

  var defaultset = false;

  // Call the getfunction
  try {
    var lf = new Error();
    eval(getfunction);
  } catch(e) { LogError(e, lf, menupopup.id, "getfuntion"); }

  GenerateMenupopup(menupopup, menu, items, defaultset, value);
}


function ProcessExtlist(menupopup, aEvent) {
  var menuitem = aEvent.target;
  var func = menuitem.parentNode.getAttribute("setfunction");
  var value = menuitem.getAttribute("value");

  try {
    var lf = new Error();
    eval(func);
  } catch(e) { LogError(e, lf, menupopup.id, "setfuntion"); }
}

function GetMenupopupItems(menupopup) {
  var RDF = goPrefBar.RDF;
  var DS = RDF.mDatasource;

  var itemId = menupopup.getAttribute("id");
  var returnArray = Array();

  // It would be possible to implement some "cache" here
  // means a "hash array" which holds the finished arrays for each id.
  // Don't know if this is worth the effort and if this is really faster
  // than reading from RDF.

  var itemindex = 1;
  while(true) {
    var Loptlabel = RDF.GetAttributeValue(DS, itemId, RDF.NC + "optionlabel" + itemindex);
    if (!Loptlabel) break;
    var optlabel = Loptlabel.Value;
    var Loptvalue = RDF.GetAttributeValue(DS, itemId, RDF.NC + "optionvalue" + itemindex);
    //if (!Loptvalue) break;
    var optvalue = Loptvalue.Value;

    returnArray.push(Array(optlabel, optvalue));
    itemindex++;
  }

  return returnArray;
}

function GenerateMenupopup(menupopup, menu, items, defaultset, value) {
  var itemId = menupopup.getAttribute("id");
  goPrefBar.dump("GenerateMenupopup: itemId: " + itemId);

  var activeitem = null;
  var defaultitem = null;

  while(menupopup.firstChild) menupopup.removeChild(menupopup.firstChild);

  var len = items.length;
  for (var itemindex = 0; itemindex < len; itemindex++) {
    var optlabel = items[itemindex][0];
    var optvalue = items[itemindex][1];

    var newitem = document.createElement('menuitem');
    if (optvalue == "PREFBARDEFAULT") defaultitem = newitem;
    if (optvalue == value) activeitem = newitem;

    newitem.setAttribute("label", optlabel);
    newitem.setAttribute("value", optvalue);
    if (menu) {
      newitem.setAttribute("type", "checkbox");
      newitem.setAttribute("checked", "false");
    }
    menupopup.appendChild(newitem);
  }

  if (defaultset && defaultitem) activeitem = defaultitem;

  if (menu)
    activeitem.setAttribute("checked", "true");
  else {
    if (activeitem)
      menupopup.parentNode.selectedItem = activeitem;
    else {
      menupopup.parentNode.selectedItem = null;
      var label = menupopup.parentNode.getAttribute("xlabel");
      menupopup.parentNode.setAttribute("label", label);
    }
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
  if (osrc && osrc.match(/prefbarOverlay\.js/)) {
    olnum = e.lineNumber - lf.lineNumber;
    osrc = "'" + fname + "' in button '" + id.substr(20) + "'";
  }
  var omsg = "PrefBar error: " + e.message;

  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
  var scriptError = Components.classes["@mozilla.org/scripterror;1"]
    .createInstance(Components.interfaces.nsIScriptError);
  scriptError.init(omsg, osrc, null, olnum, null, 2, null);
  consoleService.logMessage(scriptError);
}
