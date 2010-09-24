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
 * Portions created by the Initial Developer are Copyright (C) 2002
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


var goPrefBar = null;
var gRDF;
var gMainDS;

const ImportType_Import = 1;
const ImportType_Update = 2;
const ImportType_Reset = 3;

function Init(go) {
  goPrefBar = go;
  gRDF = goPrefBar.RDF;
  gMainDS = gRDF.mDatasource;

  if (gRDF.isEmpty) {
    doUpdate();
    goPrefBar.SetPref("extensions.prefbar.version", goPrefBar.prefbarVersion);
  }
  else
    prefbarCheckForUpdate();
}

function Export(win, toexport, filename) {
  if (toexport.length == 0) return;

  var fphandler = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);
  var exportfileobj = fphandler.getFileFromURLSpec(filename);

  // Write Template first. If this fails, then throw error (readonly?)
  try {
    gRDF.WriteBTNTemplate(exportfileobj);
  }
  catch(e) {
    goPrefBar.msgAlert(win, goPrefBar.GetString("importexport.properties", "exporterrreadonly"));
    return;
  }

  var expDS = gRDF.RDFService.GetDataSourceBlocking(filename);

  var len = toexport.length;
  for (var i = 0; i < len; i++) {
    var itemid = toexport[i];

    // No submenus!
    if (gRDF.IsContainer(gMainDS, itemid)) continue;

    // Get parent node of current node
    var parents = gRDF.GetParentNodes(gMainDS, itemid);
    if (parents.length != 1) continue; // only one parent supported
    var parent = parents[0];
    if (parent != "urn:prefbar:browserbuttons:disabled")
      parent = "urn:prefbar:browserbuttons:enabled";

    // Add node to parent container in export datasource
    gRDF.AddChildNodes(expDS, parent, itemid);

    // Copy over all attributes
    var attribs = gRDF.GetAttributes(gMainDS, itemid);
    for (var attrindex in attribs) {
      var attrib = attribs[attrindex];
      var value = gRDF.GetAttributeValue(gMainDS, itemid, attrib);
      gRDF.SetAttributeValue(expDS, itemid, attrib, value);
    }
  }

  // Flush datasource
  var remoteControll = expDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  // With the fix of Mozilla Bug 236920, Flush should fail,
  // if the disc is full
  try {
    remoteControll.Flush();
  }
  catch(e) {
    goPrefBar.msgAlert(win, goPrefBar.GetString("importexport.properties", "exporterrfailedwrite"));
  }

  // Close Datasource
  gRDF.RDFService.UnregisterDataSource(expDS);
}

function Import(win, origfilename, ImportType) {
  if (ImportType == undefined) ImportType = ImportType_Import;
  var menus = ["urn:prefbar:browserbuttons:enabled",
               "urn:prefbar:browserbuttons:disabled"];

  goPrefBar.dump("IMPORTER: Import started for " + origfilename);
  //****HACK**** (Mozilla Bug 237784) Copy to temporary file first
  var filename;
  var tempfileobj;
  // Only works with file URLs
  // Only required for non-RDF-files
  var isfileurl = origfilename.match(/^file:/i);
  var isrdf = origfilename.match(/\.rdf$/i);
  if (isfileurl && !isrdf) {
    var dirService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
    var fileprotocolService = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);

    var origfileobj = fileprotocolService.getFileFromURLSpec(origfilename);
    if (!origfileobj.exists()) return false;

    tempfileobj = dirService.get("TmpD", Components.interfaces.nsILocalFile);
    tempfileobj.append("prefbarimport.rdf");
    tempfileobj.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, parseInt("00600", 8));

    copyOver(origfileobj, tempfileobj);
    filename = fileprotocolService.getURLSpecFromFile(tempfileobj);
  }
  else
    filename = origfilename;
  //****END HACK****

  var impDS = gRDF.RDFService.GetDataSourceBlocking(filename);

  // If none of our containers exist, then user tries to import crap.
  var check1 = gRDF.IsContainer(impDS, "urn:prefbar:buttons"); // old container
  var check2 = gRDF.IsContainer(impDS, "urn:prefbar:browserbuttons:enabled");
  var check3 = gRDF.IsContainer(impDS, "urn:prefbar:browserbuttons:disabled");
  if (!check1 && !check2 && !check3) {
    goPrefBar.msgAlert(win, goPrefBar.GetString("importexport.properties", "importerrcorrupt"));
    gRDF.RDFService.UnregisterDataSource(impDS);
    if (tempfileobj) tempfileobj.remove(false);
    return false;
  }

  if (!gRDF.CanReadFormat(impDS)) {
    goPrefBar.msgAlert(win, goPrefBar.GetString("importexport.properties", "importerrversion").replace("$filename", origfilename));
    gRDF.RDFService.UnregisterDataSource(impDS);
    if (tempfileobj) tempfileobj.remove(false);
    return false;
  }

  gMainDS.beginUpdateBatch();

  if (gRDF.FormatUpdateNeeded(impDS)) {
    goPrefBar.msgAlert(win, goPrefBar.GetString("importexport.properties", "importinfooldformat").replace("$filename", origfilename));
    gRDF.PerformFormatUpdates(impDS);
  }

  var overwrite = false;
  // Reset or Update --> overwrite anything without asking
  if (ImportType == ImportType_Reset || ImportType == ImportType_Update)
    overwrite = true;
  // Import by user --> If items already exist, then ask user about what to do
  else {
    var exists = false;
    var noupdatelists = [];
    for (var menuindex in menus) {
      var children = gRDF.GetChildNodes(impDS, menus[menuindex]);
      for (var childindex in children) {
        var child = children[childindex];
        if (!exists && gRDF.NodeExists(gMainDS, child)) exists = true;
        if (gRDF.GetAttributeValue(impDS, child, gRDF.NC + "dontupdatelistitems"))
          noupdatelists.push(child.Value.replace("urn:prefbar:buttons:", ""));
      }
    }
    if (exists) {
      var msg = goPrefBar.GetString("importexport.properties", "importquestionoverwrite");
      if (noupdatelists.length > 0)
        msg += "\n(" + goPrefBar.GetString("importexport.properties", "importinfokeptlistitems") + ": " + noupdatelists.join(",") + ")";
      overwrite = goPrefBar.msgYesNo(win, msg);
    }
  }

  // Run over all possible menus in btn file
  for (var menuindex in menus) {
    var menu = menus[menuindex];

    var children = gRDF.GetChildNodes(impDS, menu);
    // New items are added as first item, so run backwards to keep order
    for (var childindex = children.length - 1; childindex >= 0; childindex--) {
      var child = children[childindex];

      var exists = gRDF.NodeExists(gMainDS, child);

      // If this item already exists in MainDS
      if (exists) {
        // If the user has chosen to not overwrite, then continue with the
        // next Button
        if(!overwrite) continue;

        //remove all old attributes
        var attribs = gRDF.GetAttributes(gMainDS, child);
        for (var attrindex in attribs) {
          var attrib = attribs[attrindex];
          // Check, if we are allowed to overwrite this property.
          // If not, then continue
          if (!Import_AllowOverwrite(impDS, child, attrib, ImportType))
            continue;

          gRDF.RemoveAttributes(gMainDS, child, attrib);
        }
      }
      else {
        gRDF.AddChildNodes(gMainDS, menu, child);
      }

      //Add all new attributes
      var attribs = gRDF.GetAttributes(impDS, child);
      for (var attrindex in attribs) {
        var attrib = attribs[attrindex];
        // Check if we are allowed to overwrite this property (if not
        // then it hasn't been deleted before and still has the old
        // value). If not, then continue
        if (exists && !Import_AllowOverwrite(impDS, child, attrib, ImportType))
          continue;

        var value = gRDF.GetAttributeValue(impDS, child, attrib);

        // If we have to write the label or optionlabel, then try to get a
        // localized version.
        if (attrib.Value.match(/prefbar#(label)$/) ||
            attrib.Value.match(/prefbar#(optionlabel\d+)$/)) {
          var pref=RegExp.$1;
          var id = child.Value.replace(/urn:prefbar:buttons:/, "");
          try {
            value = goPrefBar.GetString("buttons.properties", id + "." + pref);
          } catch(e) {}
        }

        gRDF.SetAttributeValue(gMainDS, child, attrib, value);
      }
    }
  }

  gMainDS.endUpdateBatch();
  gMainDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
  gRDF.RDFService.UnregisterDataSource(impDS);

  //****HACK**** (Mozilla Bug 237784) Delete Temporary file
  if (tempfileobj) tempfileobj.remove(false);
  //****END HACK****

  return true;
}

function Import_AllowOverwrite(aDS, aNode, aAttrib, aImportType) {
  // No need for additional checks if we reset. Everything has to be
  // overwritten.
  if (aImportType == ImportType_Reset) return true;

  var attribstring = aAttrib.Value.toUpperCase();

  // **** LABEL PROPERTY ****
  if (attribstring == "HTTP://WWW.XULPLANET.COM/RDF/PREFBAR#LABEL") {
    // If we update, we don't touch the users labels
    if (aImportType == ImportType_Update)
      return false;
  }

  // **** OPTIONLABEL/OPTIONVALUE PROPERTY ****
  if (attribstring.match(/^HTTP:\/\/WWW.XULPLANET.COM\/RDF\/PREFBAR#OPTION(LABEL|VALUE)\d+/)) {
    // We don't edit listitems, if the "DontUpdateListItems"-flag is "true"
    if (gRDF.GetAttributeValue(aDS, aNode, gRDF.NC + "dontupdatelistitems"))
      return false;
  }

  // **** HK* PROPERTIES ****
  if (attribstring.match(/^HTTP:\/\/WWW.XULPLANET.COM\/RDF\/PREFBAR#HK\w+/)) {
    // We never change the hotkeys, defined by the user
    return false;
  }

  return true;
}

function prefbarCheckForUpdate() {
  var savedVersion = goPrefBar.GetPref("extensions.prefbar.version", 0);
  if (savedVersion < goPrefBar.prefbarVersion) {
    goPrefBar.openPrefBarHP = true;
    doUpdate();
  }

  goPrefBar.SetPref("extensions.prefbar.version", goPrefBar.prefbarVersion);
}
function doUpdate() {
  Import(null, "chrome://prefbar/content/prefbar.rdf", ImportType_Update);
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
