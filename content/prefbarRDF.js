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
 * The Original Code is Preferences Toolbar 2.
 *
 * The Initial Developer of the Original Code is
 * Aaron Andersen.
 * Portions created by the Initial Developer are Copyright (C) 2___
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Aaron Andersen <aaron@xulplanet.com>
 *                 Matt Kennedy
 *                 Manuel Reimer <Manuel.Reimer@gmx.de>
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


// Globals
var goPrefBar = null;

var RDFService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                           .getService(Components.interfaces.nsIRDFService);
var RDFCU = Components.classes['@mozilla.org/rdf/container-utils;1']
  .getService().QueryInterface(Components.interfaces.nsIRDFContainerUtils);

var NC = "http://www.xulplanet.com/rdf/prefbar#";

function Init(aGO) {
  goPrefBar = aGO;
}

// "ReadRDF", together with "RDFMenu2JSON" and "OldID2NewID" read old PrefBar
// RDF based format into javascript object (JSON)
// (hopefully the last time, I have to use the crappy RDF API...)
function ReadRDF(aFile) {
  if (typeof aFile != "string") {
    var fph = Components.classes["@mozilla.org/network/protocol;1?name=file"]
      .getService(Components.interfaces.nsIFileProtocolHandler);
    aFile = fph.getURLSpecFromFile(aFile);
  }

  //****HACK**** (Mozilla Bug 237784) Copy to temporary file first
  var tempfileobj;
  // Only works with file URLs
  // Only required for non-RDF-files
  var isfileurl = aFile.match(/^file:/i);
  var isrdf = aFile.match(/\.rdf$/i);
  if (isfileurl && !isrdf) {
    var dirService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
    var fileprotocolService = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);

    var origfileobj = fileprotocolService.getFileFromURLSpec(aFile);
    if (!origfileobj.exists()) return false;

    tempfileobj = dirService.get("TmpD", Components.interfaces.nsILocalFile);
    tempfileobj.append("prefbarimport.rdf");
    tempfileobj.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, parseInt("00600", 8));

    copyOver(origfileobj, tempfileobj);
    aFile = fileprotocolService.getURLSpecFromFile(tempfileobj);
  }
  //****END HACK****

  var ds = RDFService.GetDataSourceBlocking(aFile);

  if (FormatUpdateNeeded(ds)) PerformFormatUpdates(ds);

  var json = {};
  for (var menu in {enabled:true, disabled:true}) {
    RDFMenu2JSON(ds, "urn:prefbar:browserbuttons:" + menu, json);
  }

  RDFService.UnregisterDataSource(ds);

  //****HACK**** (Mozilla Bug 237784) Delete Temporary file
  if (tempfileobj) tempfileobj.remove(false);
  //****END HACK****


  //
  // We can benefit from the new javascript object based interface,
  // enabled through JSON, from this point on
  //

  if (!json["prefbar:menu:enabled"] && !json["prefbar:menu:disabled"])
    throw("JSON file invalid/corrupted");

  // Fix up existing useragent menulists...
  var uamenulist = json["prefbar:button:useragent"];
  if (uamenulist &&
      uamenulist.type == "extlist" &&
      uamenulist.items.length > 0) {
    var defaultfound = false;
    for (var index = 0; index < uamenulist.items.length; index++) {
      if (uamenulist.items[index][1] == "PREFBARDEFAULT") {
        uamenulist.items[index][1] = "!RESET!";
        defaultfound = true;
        break;
      }
    }
    if (!defaultfound) uamenulist.items[0][1] = "!RESET!";
  }


  for (var id in json) {
    var button = json[id];
    switch (button.type) {
    case "menulist":
      // Translate "PREFBARDEFAULT" to "!RESET!"
      if ("items" in button) {
        for (var index = 0; index < button.items.length; index++) {
          if (button.items[index][1] == "PREFBARDEFAULT")
            button.items[index][1] = "!RESET!";
        }
      }
      break;
    case "spacer":
    case "separator":
      delete(button.label);
      break;
    case "extcheck":
    case "check":
    case "button":
    case "link":
      delete(button.hkenabled);
    }
  }

  // Add info header with "formatversion" set to "3" (first JSON format)
  json["prefbar:info"] = {formatversion: 3};

  return json;
}
function RDFMenu2JSON(aDS, aMenu, aJSON) {
  // Only for valid menus!
  if (!RDFCU.IsContainer(aDS, RDFService.GetResource(aMenu))) return;

  aJSON[OldID2NewID(aMenu)] = {items: []};

  var menucontainer = Components.classes["@mozilla.org/rdf/container;1"]
    .createInstance(Components.interfaces.nsIRDFContainer);
  menucontainer.Init(aDS, RDFService.GetResource(aMenu));
  var menuelements = menucontainer.GetElements();
  while (menuelements.hasMoreElements()) {
    var child = menuelements.getNext();
    child.QueryInterface(Components.interfaces.nsIRDFResource);

    var newchildid = OldID2NewID(child.Value);
    aJSON[OldID2NewID(aMenu)].items.push(newchildid);

    var type = aDS.GetTarget(child, RDFService.GetResource(NC + "type"), true);
    type.QueryInterface(Components.interfaces.nsIRDFLiteral);
    if (type.Value == "submenu")
      RDFMenu2JSON(aDS, child.Value, aJSON);
    else
      aJSON[newchildid] = {};

    if (type.Value == "menulist" || type.Value == "extlist") {
      var arr = [];
      var itemindex = 1;
      while(true) {
        var Loptlabel = aDS.GetTarget(child, RDFService.GetResource(NC + "optionlabel" + itemindex), true);
        if (!Loptlabel) break;
        Loptlabel.QueryInterface(Components.interfaces.nsIRDFLiteral);
        var optlabel = Loptlabel.Value;
        var Loptvalue = aDS.GetTarget(child, RDFService.GetResource(NC + "optionvalue" + itemindex), true);
        //if (!Loptvalue) break;
        Loptvalue.QueryInterface(Components.interfaces.nsIRDFLiteral);
        var optvalue = Loptvalue.Value;
        arr.push([optlabel, optvalue]);
        itemindex++;
      }
      aJSON[newchildid].items = arr;
    }

    var attributes = aDS.ArcLabelsOut(child);
    while(attributes.hasMoreElements()) {
      var attrib = attributes.getNext();
      attrib.QueryInterface(Components.interfaces.nsIRDFResource);
      if (attrib.Value.match(/http:\/\/www.w3.org\/1999\/02\/22-rdf-syntax-ns#/))
        continue;

      if (attrib.Value.match(/#option(value|label)/)) continue;
      var attribval = aDS.GetTarget(child, attrib, true);
      attribval.QueryInterface(Components.interfaces.nsIRDFLiteral);

      attrib = attrib.Value.replace(NC, "");
      aJSON[newchildid][attrib] = attribval.Value;
    }
  }
}
function OldID2NewID(aOldId) {
  if (!aOldId.match(/\w+:\w+:(\w+):(\w+)/)) return aOldId;
  if (RegExp.$1 == "buttons")
    return "prefbar:button:" + RegExp.$2;
  else
    return "prefbar:menu:" + RegExp.$2;
}


function copyOver(input, output) {
  var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Components.interfaces.nsIFileInputStream);
  var ostream = Components.classes["@mozilla.org/network/file-output-stream;1"]
    .createInstance(Components.interfaces.nsIFileOutputStream);
  var bstream = Components.classes["@mozilla.org/binaryinputstream;1"]
    .createInstance(Components.interfaces.nsIBinaryInputStream);

  istream.init(input, -1, 0, 0);
  bstream.setInputStream(istream);
  ostream.init(output, 0x02|0x20, parseInt("00600", 8), 0);
                     // write, truncate

  var length = bstream.available();
  ostream.write(bstream.readBytes(length), length);

  ostream.flush();
  ostream.close();
  bstream.close();
  istream.close();
}


//
// Format Version handling... We never know how often we improve the format
// used by PrefBar in future, so we need a working version handling to do the
// update if needed
//

function ReadFormatVersion(aDS) {
  var lit = aDS.GetTarget(RDFService.GetResource("urn:prefbar:info"),
                          RDFService.GetResource(NC + "formatversion"),
                          true);
  return lit ? lit.Value : 0;
}

const FormatVersion = 2; // Last used RDF format version

function FormatUpdateNeeded(datasource) {
  var toread_version = ReadFormatVersion(datasource);
  return (toread_version < FormatVersion);
}

function PerformFormatUpdates(datasource) {
  // If we get new Formats in Future it may be best to "go step by step"
  // from format to format until we are current
  if (ReadFormatVersion(datasource) == 0)
    FormatUpdate0to1(datasource);
  if (ReadFormatVersion(datasource) == 1)
    FormatUpdate1to2(datasource);
}

// The "format 0 to 1" conversion is just the removing of the
// "<br>"-replacement for newlines I've once implemented. There is no real
// reason to keep this and if someone would ask me why I ever added this I even
// would have no answer for that ;-). This function will also add the new
// "info section" to all files passed through this.
function FormatUpdate0to1(datasource) {
  var multilined_prefs =
    {"HTTP://WWW.XULPLANET.COM/RDF/PREFBAR#ONCLICK":true,
     "HTTP://WWW.XULPLANET.COM/RDF/PREFBAR#SETFUNCTION":true,
     "HTTP://WWW.XULPLANET.COM/RDF/PREFBAR#GETFUNCTION":true};
  var RButtons = RDFService.GetResource("urn:prefbar:buttons");

  var updatecontainer = Components.classes["@mozilla.org/rdf/container;1"].createInstance(Components.interfaces.nsIRDFContainer);
  updatecontainer.Init(datasource, RButtons);

  var updateelements = updatecontainer.GetElements();
  while (updateelements.hasMoreElements()) {
    var updateelement = updateelements.getNext();

    var updateproperties = datasource.ArcLabelsOut(updateelement);
    while(updateproperties.hasMoreElements()) {
      var updateproperty = updateproperties.getNext();
      var updatePropertyString = updateproperty.QueryInterface(Components.interfaces.nsIRDFResource).Value.toUpperCase();

      if (multilined_prefs[updatePropertyString] == true) {
        var Nvalue = datasource.GetTarget(updateelement, updateproperty, true);
        var value = Nvalue.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        value = value.split("<br>").join("\n");
        value = value.split("brbr>").join("br>");
        var Nnewvalue = RDFService.GetLiteral(value);

        datasource.Change(updateelement, updateproperty, Nvalue, Nnewvalue);
      }
    }
  }
  var infoSection = RDFService.GetResource("urn:prefbar:info");
  var fversionAttrib = RDFService.GetResource(NC + "formatversion");
  var newVersion = RDFService.GetLiteral(1);
  datasource.Assert(infoSection, fversionAttrib, newVersion, true);
  datasource.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
}

// The "format 1 to 2" conversion will move all stuff from urn:prefbar:buttons
// to the two sequences urn:prefbar:browserbuttons:enabled and
// urn:prefbar:browserbuttons:disabled
function FormatUpdate1to2(datasource) {
  var REnabled = RDFService.GetResource("urn:prefbar:browserbuttons:enabled");
  var RDisabled = RDFService.GetResource("urn:prefbar:browserbuttons:disabled");
  var RButtons = RDFService.GetResource("urn:prefbar:buttons");

  var RDFCU = Components.classes['@mozilla.org/rdf/container-utils;1'].getService();
  RDFCU = RDFCU.QueryInterface(Components.interfaces.nsIRDFContainerUtils);

  var CEnabled = RDFCU.MakeSeq(datasource, REnabled);
  var CDisabled = RDFCU.MakeSeq(datasource, RDisabled);
  var CButtons = Components.classes["@mozilla.org/rdf/container;1"].createInstance(Components.interfaces.nsIRDFContainer);
  CButtons.Init(datasource, RButtons);

  var REnabledPref = RDFService.GetResource(NC + "enabled");

  // Move all elements to the new sequences and kill the "enabled" pref
  var elements = CButtons.GetElements();
  while (elements.hasMoreElements()) {
    var Relement = elements.getNext();
    var LEnabled = datasource.GetTarget(Relement, REnabledPref, true);
    if (LEnabled) {
      var enabled = LEnabled.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      if (enabled == "true")
        CEnabled.AppendElement(Relement);
      else
        CDisabled.AppendElement(Relement);

      datasource.Unassert(Relement, REnabledPref, LEnabled);
    }

    if (elements.hasMoreElements())
      CButtons.RemoveElement(Relement, false);
    else
      CButtons.RemoveElement(Relement, true);
  }

  // Kill the old sequence
  var properties = datasource.ArcLabelsOut(RButtons);
  while(properties.hasMoreElements()) {
    var Rproperty = properties.getNext();
    var Lvalue = datasource.GetTarget(RButtons, Rproperty, true);
    datasource.Unassert(RButtons, Rproperty, Lvalue);
  }

  // Update FormatVersion
  var RinfoSection = RDFService.GetResource("urn:prefbar:info");
  var RversionAttrib = RDFService.GetResource(NC + "formatversion");
  var newVersion = RDFService.GetLiteral(2);
  var oldVersion = datasource.GetTarget(RinfoSection, RversionAttrib, true);
  datasource.Change(RinfoSection, RversionAttrib, oldVersion, newVersion);

  // Save database
  datasource.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
}
