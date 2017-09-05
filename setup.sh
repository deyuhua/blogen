#!/usr/bin/env bash

mkdir -p public/{images,style,script,profile}
mkdir -p private/default

npm i

# setup style file
if [[ ! -e public/style/{main,prism}.css ]]; then
    cp -rf libs/{main,prism}.css public/style/
fi

# setup script file
if [[ ! -e public/script/prism.js ]]; then
    cp -rf libs/prism.js public/script/
fi

# setup background file
if [[ ! -e public/profile/laptop.jpg ]];  then
    cp -rf libs/background.jpg public/profile/
fi

# setup init readme.md
if [[ ! -e README.md ]]; then
    touch README.md
    echo "# Hello, Welcome !!!" > README.md
fi
