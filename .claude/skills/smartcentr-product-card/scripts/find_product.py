import argparse
import json
import re
import unicodedata

from _onec import connect


def norm(value):
    value = unicodedata.normalize("NFKC", str(value or "")).casefold().replace("ё", "е")
    return " ".join(re.sub(r"[^\w]+", " ", value).split())


parser = argparse.ArgumentParser(description="Find matching products in Smart Centr production 1C")
parser.add_argument("query")
args = parser.parse_args()
query = norm(args.query)
tokens = query.split()
session = connect()
selection = session.Справочники.Номенклатура.Выбрать()
matches = []
while selection.Следующий():
    name = str(selection.Наименование or "")
    candidate = norm(name)
    if candidate == query or (tokens and all(token in candidate for token in tokens)):
        matches.append({"code": str(selection.Код or ""), "name": name})
print(json.dumps(matches, ensure_ascii=False, indent=2))

