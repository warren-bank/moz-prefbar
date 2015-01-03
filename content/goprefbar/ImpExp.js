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
 * Contributor(s): Manuel Reimer <manuel.reimer@gmx.de>
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
var gMainDS;
var _helper_functions, helper;

const ImportType_Import = 1;
const ImportType_Update = 2;
const ImportType_Soft_Reset = 3;
const ImportType_Hard_Reset = 4;

var _helper_functions = function(goPrefBar, gMainDS){
	this.goPrefBar = goPrefBar;
	this.gMainDS = gMainDS;
};
_helper_functions.prototype = {
	"is_in_menu": function(id, menu_id){
		return (this.goPrefBar.ArraySearch(id, this.gMainDS[menu_id].items) !== false);
	},

	"is_enabled": function(id){
		return this.is_in_menu(id, "prefbar:menu:enabled");
	},

	"is_disabled": function(id){
		return this.is_in_menu(id, "prefbar:menu:disabled");
	},

	"is_type": function(id, type){
		var id_pattern;
		id_pattern = new RegExp('^prefbar:' +type+ ':', 'i');
		return id_pattern.test(id);
	},

	"is_menu": function(id){
		return this.is_type(id, 'menu');
	},

	"is_button": function(id){
		return this.is_type(id, 'button');
	},

	"is_non_null_object": function(o){
		return (
			(typeof o === 'object') &&
			(o !== null)
		);
	},

	"is_array": function(o){
		return (
			(this.is_non_null_object(o)) &&
			(typeof o.constructor === 'function') &&
			(typeof o.constructor.name === 'string') &&
			(o.constructor.name.toLowerCase() === 'array') &&
			(typeof o["length"] === 'number')
		);
	},

	"is_non_empty_array": function(o){
		return (
			(this.is_array(o)) &&
			(o["length"] > 0)
		);
	},

	"remove_all_object_attributes": function(o){
		var attr;

		for (attr in o){
			delete o[attr];
		}
	},

	"copy_all_object_attributes": function(o_src, o_dst){
		var attr;

		for (attr in o_src){
			o_dst[attr] = o_src[attr];
		}
	}
};

function Init(aGO) {
  goPrefBar = aGO;
  gMainDS = goPrefBar.JSONUtils.mainDS;
  helper = new _helper_functions(goPrefBar, gMainDS);

  // If mainDS is empty (e.g. skeleton created by JSONUtils.js), then forcefully
  // trigger update to get it filled with contents of internal database
  if (gMainDS["prefbar:menu:enabled"].items.length == 0 &&
      gMainDS["prefbar:menu:disabled"].items.length == 0)
    doUpdate();
  else
    prefbarCheckForUpdate();
}

function Export(aWin, aToExport, aFileObj) {
	// sanity check
	if (
		(! helper.is_non_empty_array(aToExport))
	) {return;}

	var result, enabled, disabled, id, i, item_id;

	result = {};
	enabled = [];
	disabled = [];

	result["prefbar:info"]          = gMainDS["prefbar:info"];
	result["prefbar:menu:enabled"]  = {"items": []};
	result["prefbar:menu:disabled"] = {"items": []};

	while (aToExport.length){
		id = aToExport.shift();

		// sanity check
		if (
			(! helper.is_non_null_object( gMainDS[id] )) ||
			(typeof result[id] !== 'undefined')
		){continue;}

		result[id] = gMainDS[id];

		if (helper.is_enabled(id)){
			enabled.push(id);
		}
		else if (helper.is_disabled(id)){
			disabled.push(id);
		}

		// include submenu items
		if (
			(result[id]["type"] === "submenu") &&
			(helper.is_non_empty_array(result[id]["items"]))
		){
			for (i=0; i<result[id]["items"].length; i++){
				item_id = result[id]["items"][i];
				aToExport.push(item_id);
			}
		}
	}

	if (enabled.length > 0){
		result["prefbar:menu:enabled"]["items"] = enabled;
	}
	if (disabled.length > 0){
		result["prefbar:menu:disabled"]["items"] = disabled;
	}

	goPrefBar.JSONUtils.WriteJSON(aFileObj, result);
}

function Import(aWin, aFile, aImportType) {
	var input, is_rdf_format, overwrite;

	if (typeof aImportType === 'undefined'){
		aImportType = ImportType_Import;
	}

	try {
		// parse `aFile` as JSON
		input = goPrefBar.JSONUtils.ReadJSON(aFile);
	}
	catch(e1){
		try {
			// fall back to parsing `aFile` as an .rdf
			input = goPrefBar.RDF.ReadRDF(aFile);
			is_rdf_format = true;
		}
		catch(e2){
			// stop processing `aFile`
			goPrefBar.msgAlert(aWin, goPrefBar.GetString("importexport.properties", "importerrcorrupt"));
			// note: not going to throw an Exception, because a quick audit of the code implies that this code is NOT called from within try/catch blocks.
			// throw e2;
			return false;
		}
	}

	// sanity check
	if (! helper.is_non_null_object(input)){
		return false;
	}

	// confirm that this addon supports: `input["prefbar:info"]["formatversion"]`
	if (!goPrefBar.JSONUtils.CanReadFormat(input)) {
		goPrefBar.msgAlert(aWin, goPrefBar.GetString("importexport.properties", "importerrversion").replace("$filename", aFile.path));
		return false;
	}

	// display a notice when the format of the input file is .rdf
	if (is_rdf_format){
		goPrefBar.msgAlert(aWin, goPrefBar.GetString("importexport.properties", "importinfooldformat").replace("$filename", aFile.path));
	}

	if (aImportType === ImportType_Hard_Reset){
		helper.remove_all_object_attributes(gMainDS);
		helper.copy_all_object_attributes(input, gMainDS);
	}
	else {
		switch(aImportType){
			case ImportType_Update:
			case ImportType_Soft_Reset:
				break;

			case ImportType_Import:
			default:
				// determine whether any of the ID values to import currently exist.
				// if so, confirm with the user whether or not it is OK to proceed.
				// if not, then strip those ID values from the import data set.
				(function(){
					var existing_ids, existing_readonly_ids, ids_to_ignore, id, confirmation_message, overwrite, i;

					existing_ids = [];
					existing_readonly_ids = [];

					ids_to_ignore = ["prefbar:info","prefbar:menu:enabled","prefbar:menu:disabled"];

					for (id in input){
						// ignore items that are not user-defined
						if (goPrefBar.ArraySearch(id, ids_to_ignore) !== false){continue;}

						if (typeof gMainDS[id] !== 'undefined'){
							existing_ids.push(id);

							if (
								(gMainDS[id]["dontupdatelistitems"]) ||
								(input[id]["dontupdatelistitems"])
							){
								existing_readonly_ids.push(id);
							}
						}
					}

					if (existing_ids.length){
						confirmation_message = goPrefBar.GetString("importexport.properties", "importquestionoverwrite");

						if (existing_readonly_ids.length){
							confirmation_message += "\n(" + goPrefBar.GetString("importexport.properties", "importinfokeptlistitems") + ": " + existing_readonly_ids.join(",") + ")";
						}

						overwrite = goPrefBar.msgYesNo(aWin, confirmation_message);

						if (! overwrite){
							for (i=0; i<existing_ids.length; i++){
								id = existing_ids[i];

								// keep menus and submenus. an updated "items" list should be retained, UNLESS the object is marked readonly.
								if (! helper.is_menu(id)){
									delete input[id];
								}
								else if (goPrefBar.ArraySearch(id, existing_readonly_ids) !== false) {
									delete input[id];
								}
							}
						}
					}
				})();
				break;
		}

		// merge the import data into `gMainDS`
		(function(){
			var id, i, item_id, item_attr;

			for (id in input){
				// merge menu into existing menu?
				if (
					(helper.is_menu(id)) &&
					(helper.is_non_null_object(gMainDS[id])) &&
					(helper.is_array(gMainDS[id]["items"]))
				){
					if (
						(helper.is_non_null_object(input[id])) &&
						(helper.is_non_empty_array(input[id]["items"]))
					){
						for (i=0; i<input[id]["items"].length; i++){
							item_id = input[id]["items"][i];

							// make sure that `item_id` is a new addition
							if (goPrefBar.ArraySearch(item_id, gMainDS[id]["items"]) === false){
								gMainDS[id]["items"].push(item_id);
							}
						}
					}
				}

				// add new items
				else if (
					(! helper.is_non_null_object(gMainDS[id]))
				){
					gMainDS[id] = input[id];
				}

				// update an existing item
				else {
					// retain a few attributes
					item_attr = ["hkkey","hkkeycode","hkmodifiers"];

					if (aImportType == ImportType_Update){
						item_attr.push("label");
					}

					for (i=0; i<item_attr.length; i++){
						if (typeof gMainDS[id][ item_attr[i] ] !== 'undefined'){
							input[id][ item_attr[i] ] = gMainDS[id][ item_attr[i] ];
						}
					}

					gMainDS[id] = input[id];
				}
			}
		})();
	}

	goPrefBar.JSONUtils.MainDSUpdated();
	return true;
}

function prefbarCheckForUpdate() {
  var savedVersion = goPrefBar.GetPref("extensions.prefbar.version", 0);
  if (savedVersion < goPrefBar.prefbarVersion) {
    goPrefBar.openPrefBarHP = true;
    doUpdate();
  }
}

function doUpdate() {
  Import(null, "chrome://prefbar/content/prefbar.json", ImportType_Update);
  goPrefBar.SetPref("extensions.prefbar.version", goPrefBar.prefbarVersion);
}
