#!/bin/sh
# Склеивает кадры в один лист для просмотра: sh sheet.sh out.png a.png b.png c.png d.png
FF=node_modules/ffmpeg-static/ffmpeg
OUT=$1; shift
N=$#
IN=""; F=""; i=0
for f in "$@"; do IN="$IN -i $f"; F="$F[$i:v]scale=405:720[v$i];"; i=$((i+1)); done
L=""; j=0; while [ $j -lt $N ]; do L="$L[v$j]"; j=$((j+1)); done
$FF -v error -y $IN -filter_complex "${F}${L}hstack=inputs=$N" $OUT
