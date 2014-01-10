#!/bin/bash

set -o xtrace
DIR=`dirname $0`
ROOT=$(cd `dirname $0`/.. && pwd)

export PREFIX=$npm_config_prefix
export ETC_DIR=$npm_config_etc
export SMF_DIR=$npm_config_smfdir
export VERSION=$npm_package_version

subfile () {
  IN=$1
  OUT=$2
  sed -e "s#@@PREFIX@@#$PREFIX#g" \
      -e "s/@@VERSION@@/$VERSION/g" \
      -e "s#@@ROOT@@#$ROOT#g" \
      $IN > $OUT
}

subfile "$ROOT/smf/method/provisioner.in" "$ROOT/smf/method/provisioner"
subfile "$ROOT/smf/manifests/provisioner.xml.in" "$SMF_DIR/provisioner.xml"
chmod +x "$ROOT/smf/method/provisioner"
svccfg import $SMF_DIR/provisioner.xml
