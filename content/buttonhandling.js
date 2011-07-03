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
 * The Original Code is Preferences Toolbar 5.
 *
 * The Initial Developer of the Original Code is Manuel Reimer
 * Portions created by the Initial Developer are Copyright (C) 2011
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

// This file is loaded into context of PrefBarNS and does all the handling,
// that has to do with the buttons inside the browser, from rendering to
// updating and user interaction.
// Stuff that belongs to one button type is always grouped together in
// one object.

var ButtonHandling = {
  // Drops all children of given aTarget and recreates them from datasource
  render: function(aTarget) {
    goPrefBar.dump("ButtonHandling.render " + aTarget.id);

    if (!aTarget.hasAttribute("ref")) {
      goPrefBar.dump("ButtonHandling.render: ref attribute missing in " + aTarget.id + "!");
      return;
    }

    var menuid = aTarget.getAttribute("ref");
    var ismenu = (aTarget.tagName == "menupopup");

    // Clear target
    while(aTarget.firstChild) aTarget.removeChild(aTarget.firstChild);

    for (var index = 0; index < gMainDS[menuid].items.length; index++) {
      var btnid = gMainDS[menuid].items[index];
      var btndata = gMainDS[btnid];

      if (!(btndata.type in this)) continue;

      var btn = ButtonHandling[btndata.type].create(btndata, ismenu, btnid);
      if (!btn) continue; // No button created (spacer in menus)

      // Add ID
      btn.id = btnid;

      // Add key if menu and hotkey defined (just for display in menus)
      if (ismenu && (btndata.hkkey || btndata.hkkeycode)) {
        btn.setAttribute("key", "key:" + btnid);
      }

      // Automatically add toolbaritem nodes, where needed
      if (!ismenu && !btn.tagName.match(/^toolbar/)) {
        var tbitem = document.createElement("toolbaritem");
        tbitem.appendChild(btn);
        btn = tbitem;
      }

      aTarget.appendChild(btn);
    }
  },

  // Updates state of all children buttons of given aTarget
  update: function(aTarget, aForced) {
    goPrefBar.dump("ButtonHandling.update");

    if (!aTarget) aTarget = document.getElementById("prefbar-buttons");
    if (!aTarget) return;

    var ismenu = (aTarget.tagName == "menupopup");

    for (var index = 0; index < aTarget.children.length; index++) {
      var btn = aTarget.children[index];

      // Jump into toolbaritem nodes
      if (btn.tagName == "toolbaritem") btn = btn.firstChild;

      var btndata = gMainDS[btn.id];

      if (!this[btndata.type]) continue;
      if (!this[btndata.type].update) continue;

      // Don't update lists in submenus. This is done on popup display.
      if (ismenu && (btndata.type.match(/list$/))) continue;

      this[btndata.type].update(btn, btndata);
    }
  },

  // All hotkeys call in here to get forwarded to the right handler
  hotkey: function(aKey) {
    goPrefBar.dump("Hotkey: " + aKey.id);
    var btnid = aKey.id.replace(/^key:/, "");
    var btndata = gMainDS[btnid];

    if (!this[btndata.type]) return;
    if (!this[btndata.type].hotkey) return;

    this[btndata.type].hotkey(btnid, btndata);
  },

  // ************* Button *************
  button: {
    create: function(aData, aMenu) {
      var btn = document.createElement(aMenu ? "menuitem" : "toolbarbutton");
      btn.setAttribute("onclick", "if (event.button == 1) PrefBarNS.ButtonHandling.button.set(this, event);");
      btn.setAttribute("oncommand", "PrefBarNS.ButtonHandling.button.set(this, event);");
      btn.setAttribute("label", aData.label);
      return btn;
    },
    set: function(button, event) {
      var data = gMainDS[button.id];
      try {
        var lf = new Error();
        eval(data.onclick);
      } catch(e) { LogError(e, lf, button.id, "onclick"); }
    },
    hotkey: function(aID, aData) {
      try {
        var lf = new Error();
        eval(aData.onclick);
      } catch(e) { LogError(e, lf, aID, "onclick"); }
    }
  },

  // ************** Link *************** -->
  link: {
    create: function(aData, aMenu) {
      var btn = document.createElement(aMenu ? "menuitem" : "toolbarbutton");
      btn.setAttribute("onclick", "if (event.button == 1) PrefBarNS.ButtonHandling.link.set(this, event);");
      btn.setAttribute("oncommand", "PrefBarNS.ButtonHandling.link.set(this, event);");
      btn.setAttribute("class", (aMenu ? "menuitem-iconic " : "") + "bookmark-item");
      btn.setAttribute("label", aData.label);
      return btn;
    },
    set: function(aButton, aEvent) {
      var data = gMainDS[aButton.id];
      GoLink(data.url, aEvent);
    },
    hotkey: function(aID, aData) {
      GoLink(aData.url);
    }
  },

  // ************ Checkbox ************
  check: {
    create: function(aData, aMenu, aID) {
      var btn = document.createElement(aMenu ? "menuitem" : "checkbox");
      btn.setAttribute("oncommand", "PrefBarNS.ButtonHandling.check.set(this)");
      btn.setAttribute("label", aData.label);
      if (aMenu) btn.setAttribute("name", aID);
      return btn;
    },
    set: function(button) {
      var data = gMainDS[button.id];
      var value;
      if (button.tagName == "checkbox")
        value = button.checked;
      else
        value = (button.getAttribute("type") == "radio");

      goPrefBar.SetPref(data.prefstring, eval(data.topref));
    },
    update: function(button, data) {
      // Value is magic variable referenced in frompref
      var value = goPrefBar.GetPref(data.prefstring);

      var checked = eval(data.frompref);

      if (button.tagName == "checkbox")
        button.setAttribute("checked", checked);
      else {
        var tvalue = checked ? "checkbox" : "radio";
        button.setAttribute("type", tvalue);
        button.setAttribute("checked", "true");
      }
    },
    hotkey: function(aID, aData) {
      var value = goPrefBar.GetPref(aData.prefstring);
      var checked = eval(aData.frompref);
      value = !checked;
      value = eval(aData.topref);
      goPrefBar.SetPref(aData.prefstring, value);

      var msg;
      if (!checked)
        msg = goPrefBar.GetString("prefbarOverlay.properties", "enabled");
      else
        msg = goPrefBar.GetString("prefbarOverlay.properties", "disabled");
      OSDMessage(aData.label + ": " + msg);

      ButtonHandling.update();
    }
  },

  // ************ Extcheck ************
  extcheck: {
    create: function(aData, aMenu, aID) {
      var btn = ButtonHandling.check.create(aData, aMenu, aID);
      btn.setAttribute("oncommand", "PrefBarNS.ButtonHandling.extcheck.set(this, event)");
      return btn;
    },
    set: function(button, event) {
      var data = gMainDS[button.id];

      var func = data.setfunction;

      var value;
      if (button.tagName == "checkbox")
        value = button.checked;
      else
        value = (button.getAttribute("type") == "radio");

      try {
        var lf = new Error();
        eval(func);
      } catch(e) { LogError(e, lf, button.id, "setfuntion"); }
    },
    update: function(button, aData) {
      var func = aData.getfunction;

      var value;
      try {
        var lf = new Error();
        eval(func);
      } catch(e) { LogError(e, lf, button.id, "getfuntion"); }

      if (button.tagName == "checkbox")
        button.setAttribute("checked", value);
      else {
        var tvalue = value ? "checkbox" : "radio";
        button.setAttribute("type", tvalue);
        button.setAttribute("checked", "true");
      }
    },
    hotkey: function(aID, aData) {
      var value;
      eval(aData.getfunction);
      value = !value;
      eval(aData.setfunction);

      var msg;
      if (value)
        msg = goPrefBar.GetString("prefbarOverlay.properties", "enabled");
      else
        msg = goPrefBar.GetString("prefbarOverlay.properties", "disabled");
      OSDMessage(aData.label + ": " + msg);

      ButtonHandling.update();
    }
  },

  // *********** Menulist ************
  menulist: {
    create: function(aData, aMenu) {
      var btn = document.createElement(aMenu ? "menu" : "menulist");
      btn.setAttribute("label", aData.label);
      if (aMenu)
        btn.setAttribute("onpopupshowing", "PrefBarNS.ButtonHandling.menulist.update(this);");
      else
        btn.setAttribute("tooltiptext", aData.label);

      var menupopup = document.createElement("menupopup");
      menupopup.setAttribute("oncommand", "PrefBarNS.ButtonHandling.menulist.set(this, event);");
      btn.appendChild(menupopup);

      var menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", " ");
      menupopup.appendChild(menuitem);

      return btn;
    },
    set: function(menupopup, aEvent) {
      var data = gMainDS[menupopup.parentNode.id];
      var menuitem = aEvent.target;
      var prefBranch = goPrefBar.PrefBranch;

      var pref = data.prefstring;
      var value = menuitem.getAttribute("value");
      var type = prefBranch.getPrefType(pref);

      if (value == "PREFBARDEFAULT" || value == "!RESET!")
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
    },
    update: function(button, data) {
      // data is undefined, if called via "onpopupshowing"
      if (!data) data = gMainDS[button.id];

      var menu = (button.tagName == "menu");
      var menupopup = button.menupopup;
      var prefstring = data.prefstring;

      var prefBranch = goPrefBar.PrefBranch;
      var prefHasUserValue = prefBranch.prefHasUserValue(prefstring);

      var prefvalue = String(goPrefBar.GetPref(prefstring));

      var items = data.items;
      this._gen_menupopup(menupopup, menu, items, !prefHasUserValue, prefvalue);
    },
    _gen_menupopup: function(aMenuPopup, aIsMenu, aItems, aDefaultset, aValue) {
      var menu = aMenuPopup.parentNode;
      goPrefBar.dump("_gen_menupopup: itemId: " + menu.id);

      var activeitem;
      var defaultitem;

      while(aMenuPopup.firstChild) aMenuPopup.removeChild(aMenuPopup.firstChild);

      for (var itemindex = 0; itemindex < aItems.length; itemindex++) {
        var optlabel = aItems[itemindex][0];
        var optvalue = aItems[itemindex][1];

        var newitem = document.createElement('menuitem');
        if (optvalue == "PREFBARDEFAULT" ||
            optvalue == "!RESET!") defaultitem = newitem;
        if (optvalue == aValue) activeitem = newitem;

        newitem.setAttribute("label", optlabel);
        newitem.setAttribute("value", optvalue);
        if (aIsMenu) {
          newitem.setAttribute("type", "checkbox");
          newitem.setAttribute("checked", "false");
        }
        aMenuPopup.appendChild(newitem);
      }

      if (aDefaultset && defaultitem) activeitem = defaultitem;

      if (aIsMenu)
        activeitem.setAttribute("checked", "true");
      else {
        if (activeitem)
          menu.selectedItem = activeitem;
        else {
          menu.selectedItem = null;
          menu.setAttribute("label", gMainDS[menu.id].label);
        }
      }
    }
  },

  // *********** Extlist ************
  extlist: {
    create: function(aData, aMenu) {
      var btn = ButtonHandling.menulist.create(aData, aMenu);
      if (aMenu) btn.setAttribute("onpopupshowing", "PrefBarNS.ButtonHandling.extlist.update(this);");
      btn.firstChild.setAttribute("oncommand", "PrefBarNS.ButtonHandling.extlist.set(this, event);");
      return btn;
    },
    set: function(menupopup, event) {
      var data = gMainDS[menupopup.parentNode.id];

      var menuitem = event.target;
      var func = data.setfunction;
      var value = menuitem.getAttribute("value");

      try {
        var lf = new Error();
        eval(func);
      } catch(e) { LogError(e, lf, menupopup.id, "setfuntion"); }
    },
    update: function(button, data) {
      // data is undefined, if called via "onpopupshowing"
      if (!data) data = gMainDS[button.id];

      var menu = (button.tagName == "menu");
      var menupopup = button.menupopup;
      var getfunction = data.getfunction;

      // The variables that may be modified by the getfunction
      /* value to select in list */
      var value = "";
      /* Here we have the array of all items defined via GUI. The array has
         two dimensions. First is the index and second is label(0) and value(1)
         feel free to edit,read,parse special values or dump new items in here
         from wherever you read them */
      var items = [];
      for (var index = 0; index < data.items.length; index++) {
        var srcarray = data.items[index];
        items.push(srcarray.slice());
      }

      var defaultset = false;

      // Call the getfunction
      try {
        var lf = new Error();
        eval(getfunction);
      } catch(e) { LogError(e, lf, menupopup.id, "getfuntion"); }

      ButtonHandling.menulist._gen_menupopup(menupopup, menu, items, defaultset, value);
    }
  },

  // ************** Text ***************
  text: {
    create: function(aData, aMenu) {
      var btn = document.createElement(aMenu ? "menuitem" : "description");
      if (aMenu) {
        btn.setAttribute("disabled", "true");
        btn.setAttribute("label", aData.label);
      }
      else {
        btn.setAttribute("crop", "end");
        btn.setAttribute("value", aData.label);
      }
      return btn;
    }
  },

  // *********** Separator *************
  separator: {
    create: function(aData, aMenu) {
      return document.createElement(aMenu ? "menuseparator" : "toolbarseparator");
    }
  },

  // ************* Spacer **************
  spacer: {
    create: function(aData, aMenu) {
      if (aMenu) return false; // No spacer for menupopups needed!
      var btn = document.createElement("toolbarspacer");
      btn.setAttribute("flex", "1");
      return btn;
    }
  },

  // *********** Submenu *************
  submenu: {
    create: function(aData, aMenu, aID) {
      var btn = document.createElement(aMenu ? "menu" : "toolbarbutton");
      if (!aMenu) btn.setAttribute("type", "menu");
      btn.setAttribute("label", aData.label);

      var menupopup = document.createElement("menupopup");
      menupopup.setAttribute("ref", aID);
      menupopup.setAttribute("onpopupshowing", "PrefBarNS.ButtonHandling.update(this);");
      ButtonHandling.render(menupopup);
      btn.appendChild(menupopup);

      return btn;
    }
  }
};
