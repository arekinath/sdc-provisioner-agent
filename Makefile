#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#
# Makefile: basic Makefile for template API service
#
# This Makefile is a template for new repos. It contains only repo-specific
# logic and uses included makefiles to supply common targets (javascriptlint,
# jsstyle, restdown, etc.), which are used by other repos as well. You may well
# need to rewrite most of this file, but you shouldn't need to touch the
# included makefiles.
#
# If you find yourself adding support for new targets that could be useful for
# other projects too, you should add these to the original versions of the
# included Makefiles (in eng.git) so that other teams can use them too.
#

#
# Tools
#

#
# Files
#
DOC_FILES	 = index.restdown
JS_FILES	:= $(shell ls *.js 2>/dev/null) $(shell find lib test -name '*.js' 2>/dev/null)
JSL_CONF_NODE	 = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS    = -o indent=4,doxygen,unparenthesized-return=0
#REPO_MODULES	 = src/node-dummy
SMF_MANIFESTS_IN = smf/manifests/provisioner.xml.in

#NODE_PREBUILT_BRANCH=master-20120703T175035Z
#NODE_PREBUILT_DIR ?= https://download.joyent.com/pub/build/sdcnode/$(NODE_PREBUILT_BRANCH)/sdcnode
NODE_PREBUILT_VERSION=v0.8.9
NODE_PREBUILT_TAG=gz

# Included definitions
include ./tools/mk/Makefile.defs
include ./tools/mk/Makefile.node_prebuilt.defs
include ./tools/mk/Makefile.node_deps.defs
include ./tools/mk/Makefile.smf.defs

ROOT            := $(shell pwd)
RELEASE_TARBALL := provisioner-pkg-$(STAMP).tar.gz
TMPDIR          := /tmp/$(STAMP)

#
# Repo-specific targets
#
.PHONY: all
all: $(SMF_MANIFESTS) | $(TAP) $(REPO_DEPS)
	$(NPM) rebuild

$(TAP): | $(NPM_EXEC)
	$(NPM) install

CLEAN_FILES += $(TAP) ./node_modules/tap

.PHONY: test
test: $(TAP)
	TAP=1 $(TAP) test/*.test.js

.PHONY: release
release: all deps docs $(SMF_MANIFESTS)
	@echo "Building $(RELEASE_TARBALL)"
	@mkdir -p $(TMPDIR)/provisioner
	cd $(ROOT) && $(NPM) install
	cp -r $(ROOT)/build \
    $(ROOT)/bin \
    $(ROOT)/lib \
    $(ROOT)/Makefile \
    $(ROOT)/node_modules \
    $(ROOT)/package.json \
    $(ROOT)/smf \
    $(ROOT)/npm \
    $(ROOT)/tools \
    $(TMPDIR)/provisioner
	(cd $(TMPDIR) && $(TAR) -zcf $(ROOT)/$(RELEASE_TARBALL) *)
	@rm -rf $(TMPDIR)

include ./tools/mk/Makefile.deps
include ./tools/mk/Makefile.node_prebuilt.targ
include ./tools/mk/Makefile.node_deps.targ
include ./tools/mk/Makefile.smf.targ
include ./tools/mk/Makefile.targ
