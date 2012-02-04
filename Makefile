# -*- Mode: Makefile -*-
#
# Makefile for PrefBar
#

VERSION=6.1.0
BUILD=20110913

all: patch jar xpi

patch:
	sed -r "s/(<em:version>)[^<]*/\1$(VERSION)/" \
    -i install.rdf
	sed -r "s/(v\. ).*(, &builddate; )[0-9]*/\1$(VERSION)\2$(BUILD)/" \
    -i content/help/index.xhtml
	sed -r "s/(const prefbarVersion = )[^;]*/\1$(BUILD)/" \
    -i content/prefbar.js

jar:
	@if [ ! -d chrome ]; then mkdir chrome; fi
	@if [ -f chrome/prefbar.jar ]; then rm chrome/prefbar.jar; fi
	zip -r0 chrome/prefbar.jar content skin locale -x '*/CVS/*' -x '*~'

xpi: jar
	@if [ -f prefbar-trunk.xpi ]; then rm prefbar-trunk.xpi; fi
	zip -9 prefbar-trunk.xpi chrome/prefbar.jar \
                         components/goprefbar.js \
                         defaults/preferences/prefs.js \
                         chrome.manifest \
                         install.rdf

clean:
	rm -f prefbar-trunk.xpi
	rm -f chrome/prefbar.jar
	if [ -d chrome ]; then rmdir chrome; fi

check-tree:
	@if [ -d .git ]; then \
	  if [ -n "$$(git status --porcelain)" ]; then \
	    echo "There are uncommitted changes!"; exit 1; \
	  fi \
	fi

# Fetches japanese locale, which is developed external on a SVN server.
update-ja: check-tree
	@if [ -d locale/ja ]; then rm -r locale/ja; fi
	svn export https://minefield-jlp.googlecode.com/svn/trunk/chrome/locale/prefbar/ locale/ja/
