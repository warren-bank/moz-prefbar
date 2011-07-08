# -*- Mode: Makefile -*-
#
# Makefile for PrefBar
#

VERSION=6.0.0
BUILD=20110708

all: patch jar xpi

patch:
	sed -r "s/(<em:version>)[^<]*/\1$(VERSION)/" \
    -i install.rdf
	sed -r "s/(v\. ).*(, build date )[0-9]*/\1$(VERSION)\2$(BUILD)/" \
    -i locale/*/help/index.html
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
                         install.rdf \
                         install.js

clean:
	rm -f prefbar-trunk.xpi
	rm -f chrome/prefbar.jar
	if [ -d chrome ]; then rmdir chrome; fi
