#!/usr/bin/perl
# De-Entitizer for converting entitized XHTML back to standard XHTML
# Copyright (C) 2014  Manuel Reimer <manuel.reimer@gmx.de>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

use strict;
use warnings;
use Getopt::Std;
use File::Basename;

{
  my %opts;
  getopt('ol', \%opts);
  Usage() unless (defined($opts{o}) &&
                  defined($opts{l}));

  foreach my $inputfile (@ARGV) {
    (my $outputfile = basename($inputfile)) =~ s/\.xhtml$/.html/i;

    # Get file contents
    open(my $fhin, '<', $inputfile) or die();
    read($fhin, my $content, -s $fhin);
    close($fhin);

    # Get list of used DTD files
    my @dtdfiles = $content =~ m#<!ENTITY % \w+ SYSTEM "([^"]+)#g;

    # Read all entities from DTD files
    my %entities;
    foreach my $dtdfile (@dtdfiles) {
      $dtdfile =~ s#^.*?/locale#$opts{l}#;
      ReadDTD($dtdfile, \%entities);
    }

    # Fixup DOCTYPE declaration
    $content =~ s#(<!DOCTYPE[^\[]+) \[[^\]]+\]#$1#m;

    # Fix all "internal links" (make them point to the .html file, not .xhtml)
    $content =~ s#(<a href="[^:"]+)\.xhtml#$1.html#g;

    # Fix "favicon" link
    $content =~ s#(<link rel="icon" href=")chrome://[a-z]+/skin/#$1#;

    # Replace all entities with their value
    while (my($entity, $value) = each(%entities)) {
      $content =~ s#&\Q$entity\E;#$value#g;
    }

    # Write output file
    open(my $fhout, '>', "$opts{o}/$outputfile") or die();
    print $fhout $content;
    close($fhout);
  }
}

sub Usage {
  print basename($0) . "-o OUTPUTDIR -l LOCALEPATH FILE1 [FILEn] ...\n";
  exit(0);
}

sub ReadDTD {
  my ($aPath, $aHashRef) = @_;

  open(my $fhdtd, '<', $aPath) or die("Can't read $aPath");
  while (my $line = <$fhdtd>) {
    chomp($line);
    $aHashRef->{$1} = $2 if ($line =~ m#<!ENTITY (\S+) +"([^"]*)">#);
  }
  close($fhdtd);
}
