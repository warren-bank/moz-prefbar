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

var mDatasource = null;
var FormatVersion = null;

var NC = "http://www.xulplanet.com/rdf/prefbar#";

function Init(go) {
  goPrefBar = go;

  var tmpInternalDS = RDFService.GetDataSourceBlocking("chrome://prefbar/content/prefbar.rdf");
  FormatVersion = ReadFormatVersion(tmpInternalDS);

  CheckForDataFile();

  var fDS = prefbarGetProfileDir("prefbar.rdf");
  mDatasource = RDFService.GetDataSourceBlocking(fDS);

  if (!CanReadFormat(mDatasource))
    goPrefBar.msgAlert(null, goPrefBar.GetString("rdf.properties", "cantreadformat"));

  if (FormatUpdateNeeded(mDatasource)) {
    goPrefBar.msgAlert(null, goPrefBar.GetString("rdf.properties", "formatupdateneeded"));
    PerformFormatUpdates(mDatasource);
    goPrefBar.msgAlert(null, goPrefBar.GetString("rdf.properties", "formatupdatefinished"));
  }
}

function AddmDatasource(element) {
  element.database.AddDataSource(mDatasource);
  element.builder.rebuild();
}

var isEmpty = false;
function CheckForDataFile() {
  var targeturl = prefbarGetProfileDir("prefbar.rdf");

  var fphandler = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);
  var target = fphandler.getFileFromURLSpec(targeturl);

  if(target.exists()) return;

  WriteBTNTemplate(target);
  isEmpty = true;
}

function WriteBTNTemplate(ofile) {
  var t;
  t =  '<?xml version="1.0"?>\n';
  t += '<RDF:RDF xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n';
  t += '         xmlns:prefbar="' + NC + '">\n';
  t += '  <RDF:resource about="urn:prefbar:info" prefbar:formatversion="' + FormatVersion + '"/>\n';
  t += '</RDF:RDF>\n';

  var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);

  outputStream.init(ofile, 0x02|0x08|0x20, parseInt("00640", 8), null);
                         // write, create, truncate

  outputStream.write(t, t.length);

  outputStream.flush();
  outputStream.close();
}

function prefbarGetProfileDir(subdir) {
  var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
                             .getService(Components.interfaces.nsIProperties);
  var profDir = dirService.get("ProfD", Components.interfaces.nsIFile);
  if (subdir) profDir.append(subdir);
  var fileHandler = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);

  return fileHandler.getURLSpecFromFile(profDir);
}

//
// Format Version handling... We never know how often we improve the format
// used by PrefBar in future, so we need a working version handling to do the
// update if needed
//

function ReadFormatVersion(aDS) {
  var lit = GetAttributeValue(aDS, "urn:prefbar:info", NC + "formatversion");
  return lit ? lit.Value : 0;
}

function CanReadFormat(datasource) {
  var toread_version = ReadFormatVersion(datasource);
  return (toread_version <= FormatVersion);
}

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


//
// Abstraction layer to simplify all this silly RDF stuff...
//

// Attribute translation functions
function _ResAttr(aResource) {
  if (typeof aResource == "string")
    return RDFService.GetResource(aResource);
  return aResource;
}
function _LitAttr(aLiteral) {
  if (typeof aLiteral == "string")
    return RDFService.GetLiteral(aLiteral);
  return aLiteral;
}
function _ArrayAttr(aArray) {
  if (!goPrefBar.IsArray(aArray))
    return [aArray];
  return aArray;
}

// True if given node exists in given datasource
function NodeExists(aDS, aNode) {
  return aDS.ArcLabelsOut(_ResAttr(aNode)).hasMoreElements();
}

// Returns true if node is container. False otherwise
function IsContainer(aDS, aNode) {
  return RDFCU.IsContainer(aDS, _ResAttr(aNode));
}

// Takes datasource and node and converts node into container
function MakeContainer(aDS, aNode) {
  return RDFCU.MakeSeq(aDS, _ResAttr(aNode));
}

// Returns index of given node in given container node
function GetIndexOf(aDS, aContainer, aNode) {
  var container = Components.classes["@mozilla.org/rdf/container;1"]
    .createInstance(Components.interfaces.nsIRDFContainer);
  container.Init(aDS, _ResAttr(aContainer));
  return container.IndexOf(_ResAttr(aNode));
}

// Takes a datasource and a node and returns array of child nodes
function GetChildNodes(aDS, aNode) {
  var retarray = [];
  if (!IsContainer(aDS, aNode)) return retarray; // No container --> empty array
  var container = Components.classes["@mozilla.org/rdf/container;1"]
    .createInstance(Components.interfaces.nsIRDFContainer);
  container.Init(aDS, _ResAttr(aNode));
  var elements = container.GetElements();
  while (elements.hasMoreElements()) {
    var item = elements.getNext();
    item.QueryInterface(Components.interfaces.nsIRDFResource);
    retarray.push(item);
  }
  return retarray;
}

// Takes a datasource and a node and returns array of parent nodes
function GetParentNodes(aDS, aNode) {
  var retarray = [];
  var elements = aDS.ArcLabelsIn(_ResAttr(aNode));
  while(elements.hasMoreElements()) {
    var item = elements.getNext();
    if (item instanceof Components.interfaces.nsIRDFResource) {
      if (RDFCU.IsOrdinalProperty(item)) {
        var parent = aDS.GetSource(item, _ResAttr(aNode), true);
        parent.QueryInterface(Components.interfaces.nsIRDFResource);
        retarray.push(parent);
      }
    }
  }
  return retarray;
}

// Takes datasource and parent node and adds all given child nodes.
// Optionally, a target index may be passed.
function AddChildNodes(aDS, aParentRes, aChildResArray, aOptionalIndex) {
  if (!aOptionalIndex) aOptionalIndex = 1;
  var container = RDFCU.MakeSeq(aDS, _ResAttr(aParentRes));
  var children = _ArrayAttr(aChildResArray);
  var childrenlen = children.length;
  for (var index = 0; index < childrenlen; index++) {
    var item = _ResAttr(children[index]);
    container.InsertElementAt(item, aOptionalIndex, true);
    aOptionalIndex++;
  }
}

// Takes datasource and parent node. Removes all given child nodes
function RemoveChildNodes(aDS, aParentRes, aChildResArray) {
  var container = Components.classes["@mozilla.org/rdf/container;1"]
    .createInstance(Components.interfaces.nsIRDFContainer);
  container.Init(aDS, _ResAttr(aParentRes));
  var children = _ArrayAttr(aChildResArray);
  var childrenlen = children.length;
  for (var index = 0; index < childrenlen; index++) {
    var item = _ResAttr(children[index]);
    if (index < childrenlen - 1)
      container.RemoveElement(item, false);
    else
      container.RemoveElement(item, true);
  }
}

// Takes a datasource and a node and returns array of attributes
// If third attribute is true, "pseudo attributes" used by the mozilla backend
// are also returned. Most probably this is only useful to safely delete nodes
function GetAttributes(aDS, aNode, aPseudo) {
  var retarray = [];
  var attributes = aDS.ArcLabelsOut(_ResAttr(aNode));
  while(attributes.hasMoreElements()) {
    var item = attributes.getNext();
    item.QueryInterface(Components.interfaces.nsIRDFResource);
    if (!aPseudo &&
        item.Value.match(/http:\/\/www.w3.org\/1999\/02\/22-rdf-syntax-ns#/))
      continue;
    retarray.push(item);
  }
  return retarray;
}

// Removes one or more attributes from node
function RemoveAttributes(aDS, aNode, aResAttrArray) {
  var retval = true;
  var attribs = _ArrayAttr(aResAttrArray);
  var attribslen = attribs.length;
  for (var index = 0; index < attribslen; index++) {
    var attrres = _ResAttr(attribs[index]);
    if (!aDS.hasArcOut(_ResAttr(aNode), attrres)) {
      retval = false;
      continue;
    }
    var oldvalue = GetAttributeValue(aDS, aNode, attrres);
    aDS.Unassert(_ResAttr(aNode), attrres, oldvalue, true);
  }
  return retval;
}

// Gets value of attribute
function GetAttributeValue(aDS, aNode, aResAttr) {
  var value = aDS.GetTarget(_ResAttr(aNode), _ResAttr(aResAttr), true);
  if (!value) return false;
  // for some "pseudo attributes" set by mozilla (rdf-syntax-ns#instanceOf)
  if (value instanceof Components.interfaces.nsIRDFResource)
    value.QueryInterface(Components.interfaces.nsIRDFResource);
  else
    value.QueryInterface(Components.interfaces.nsIRDFLiteral);
  return value;
}

// Sets value of attribute
function SetAttributeValue(aDS, aNode, aResAttr, aLitValue) {
  var oldvalue = GetAttributeValue(aDS, aNode, aResAttr);
  if (oldvalue)
    aDS.Change(_ResAttr(aNode),
               _ResAttr(aResAttr),
               oldvalue,
               _LitAttr(aLitValue));
  else
    aDS.Assert(_ResAttr(aNode),
               _ResAttr(aResAttr),
               _LitAttr(aLitValue),
               true);
}
