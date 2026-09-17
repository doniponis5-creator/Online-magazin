"""
Сборка XML-файлов расширения 1С «ИМ_ОнлайнМагазин» (Онлайн магазин).

Расширение только ДОБАВЛЯЕТ объекты и не меняет основную конфигурацию:
  • РегистрСведений.ИМ_ТоварыСайта  — настройки товара для сайта;
  • РегистрСведений.ИМ_ФотоТоваров  — фото товаров (JPEG после редактора);
  • ОбщийМодуль.ИМ_ОнлайнМагазинСервер — цены, остатки, запись настроек и фото;
  • Обработка.ИМ_ОнлайнМагазин       — список товаров, карточка товара, редактор фото;
  • Подсистема.ИМ_ОнлайнМагазин      — раздел «Онлайн магазин» в меню;
  • Роль.ИМ_ОсновнаяРоль             — права на новые объекты.
Заимствуются только: Справочник.Номенклатура (тип измерения) и языки.

Идентификаторы (uuid) детерминированные: повторная сборка даёт те же uuid,
поэтому данные регистров сохраняются при обновлении расширения.

Запуск:  python build_extension.py bas|ut
Результат: build/<вариант>/ — каталог для /LoadConfigFromFiles.
"""

import shutil
import sys
import uuid
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
EXT = "ИМ_ОнлайнМагазин"
NS = uuid.UUID("5f0c7c1e-2a61-4a8e-9a57-6b1b8a3c0d11")

# Объекты основной конфигурации (uuid из выгрузок base_dumps; Номенклатура совпадает в УТ и BAS).
VARIANTS = {
    "bas": {
        "languages": [("Русский", "ru", "1ef70f33-bcfa-4275-a22f-8601fbdc5648"),
                      ("Украинский", "uk", "e4d3729f-5fc8-4d13-96d8-d31279631b2c")],
        "default_language": "Украинский",
    },
    "ut": {
        "languages": [("Русский", "ru", "0663bf5b-bcba-4a40-a862-a0b3baa2d884")],
        "default_language": "Русский",
    },
}
NOMENCLATURE_UUID = "fc59acc3-f1f7-4e3f-96da-e580f2c5a88f"

# Справочники основной конфигурации, которые нужны как типы (одинаковые uuid в УТ 11.5 и BAS).
ADOPTED_CATALOGS = {
    "Номенклатура": "fc59acc3-f1f7-4e3f-96da-e580f2c5a88f",
    "Организации": "35a6d3c8-3832-419f-81ef-fc7c113af6a4",
    "Склады": "07b3c407-9a3a-4f94-b798-226c96d66840",
    "Кассы": "f580f9ef-6c59-4e60-b909-3bb429771dc5",
    "СоглашенияСКлиентами": "2bb5c12e-1217-4c8d-ae01-3a6253cfe429",
}

NAMESPACES = (
    'xmlns:app="http://v8.1c.ru/8.2/managed-application/core" '
    'xmlns:cfg="http://v8.1c.ru/8.1/data/enterprise/current-config" '
    'xmlns:ent="http://v8.1c.ru/8.1/data/enterprise" xmlns:lf="http://v8.1c.ru/8.2/managed-application/logform" '
    'xmlns:style="http://v8.1c.ru/8.1/data/ui/style" xmlns:sys="http://v8.1c.ru/8.1/data/ui/fonts/system" '
    'xmlns:v8="http://v8.1c.ru/8.1/data/core" xmlns:v8ui="http://v8.1c.ru/8.1/data/ui" '
    'xmlns:web="http://v8.1c.ru/8.1/data/ui/colors/web" xmlns:win="http://v8.1c.ru/8.1/data/ui/colors/windows" '
    'xmlns:xr="http://v8.1c.ru/8.3/xcf/readable" xmlns:xs="http://www.w3.org/2001/XMLSchema" '
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="2.20"'
)
HEADER = (
    '<?xml version="1.0" encoding="UTF-8"?>\n<MetaDataObject xmlns="http://v8.1c.ru/8.3/MDClasses" '
    'xmlns:cmi="http://v8.1c.ru/8.2/managed-application/cmi" xmlns:xen="http://v8.1c.ru/8.3/xcf/enums" '
    'xmlns:xpr="http://v8.1c.ru/8.3/xcf/predef" ' + NAMESPACES + ">\n"
)
FORM_HEADER = (
    '<?xml version="1.0" encoding="UTF-8"?>\n<Form xmlns="http://v8.1c.ru/8.3/xcf/logform" '
    'xmlns:dcscor="http://v8.1c.ru/8.1/data-composition-system/core" '
    'xmlns:dcsset="http://v8.1c.ru/8.1/data-composition-system/settings" ' + NAMESPACES + ">\n"
)


def uid(key):
    return str(uuid.uuid5(NS, key))


def text(value, lang="ru"):
    return f"<v8:item><v8:lang>{lang}</v8:lang><v8:content>{escape(value)}</v8:content></v8:item>"


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8-sig")


def generated_types(kind, name, categories):
    rows = []
    for type_name, category in categories:
        key = f"{kind}.{name}.{type_name}"
        rows.append(
            f'<xr:GeneratedType name="{type_name}.{name}" category="{category}">'
            f"<xr:TypeId>{uid(key + '.type')}</xr:TypeId><xr:ValueId>{uid(key + '.value')}</xr:ValueId>"
            "</xr:GeneratedType>"
        )
    return "<InternalInfo>" + "".join(rows) + "</InternalInfo>"


# ── Типы ─────────────────────────────────────────────────────────────────────

def t_bool():
    return "<v8:Type>xs:boolean</v8:Type>"


def t_num(digits, fraction=0, sign="Nonnegative"):
    return (f"<v8:Type>xs:decimal</v8:Type><v8:NumberQualifiers><v8:Digits>{digits}</v8:Digits>"
            f"<v8:FractionDigits>{fraction}</v8:FractionDigits><v8:AllowedSign>{sign}</v8:AllowedSign></v8:NumberQualifiers>")


def t_str(length):
    return (f"<v8:Type>xs:string</v8:Type><v8:StringQualifiers><v8:Length>{length}</v8:Length>"
            "<v8:AllowedLength>Variable</v8:AllowedLength></v8:StringQualifiers>")


def t_date():
    return "<v8:Type>xs:dateTime</v8:Type><v8:DateQualifiers><v8:DateFractions>DateTime</v8:DateFractions></v8:DateQualifiers>"


def t_nomenclature():
    return "<v8:Type>cfg:CatalogRef.Номенклатура</v8:Type>"


def t_catalog(name):
    return f"<v8:Type>cfg:CatalogRef.{name}</v8:Type>"


def t_storage():
    return "<v8:Type>v8:ValueStorage</v8:Type>"


def t_uuid():
    return "<v8:Type>v8:UUID</v8:Type>"


def fill_value(type_xml):
    if "boolean" in type_xml:
        return '<FillValue xsi:type="xs:boolean">false</FillValue>'
    if "decimal" in type_xml:
        return '<FillValue xsi:type="xs:decimal">0</FillValue>'
    if "xs:string" in type_xml:
        return '<FillValue xsi:type="xs:string"/>'
    return '<FillValue xsi:nil="true"/>'


# ── Регистры сведений ────────────────────────────────────────────────────────

def field_properties(name, title, type_xml, dimension=False):
    extra = ("<Master>false</Master><MainFilter>true</MainFilter><DenyIncompleteValues>true</DenyIncompleteValues>"
             if dimension else "")
    indexing = "Index" if dimension else "DontIndex"
    search = "DontUse" if "ValueStorage" in type_xml else "Use"
    tail = "<TypeReductionMode>TransformValues</TypeReductionMode>" if dimension else ""
    return (
        f"<Properties><Name>{name}</Name><Synonym>{text(title)}</Synonym><Comment/>"
        f"<Type>{type_xml}</Type><PasswordMode>false</PasswordMode><Format/><EditFormat/><ToolTip/>"
        "<MarkNegatives>false</MarkNegatives><Mask/><MultiLine>false</MultiLine><ExtendedEdit>false</ExtendedEdit>"
        '<MinValue xsi:nil="true"/><MaxValue xsi:nil="true"/><FillFromFillingValue>false</FillFromFillingValue>'
        f"{fill_value(type_xml)}<FillChecking>DontCheck</FillChecking><ChoiceFoldersAndItems>Items</ChoiceFoldersAndItems>"
        "<ChoiceParameterLinks/><ChoiceParameters/><QuickChoice>Auto</QuickChoice><CreateOnInput>Auto</CreateOnInput>"
        "<ChoiceForm/><LinkByType/><ChoiceHistoryOnInput>Auto</ChoiceHistoryOnInput>"
        f"{extra}<Indexing>{indexing}</Indexing><FullTextSearch>{search}</FullTextSearch><DataHistory>Use</DataHistory>{tail}"
        "</Properties>"
    )


def build_register(out, name, synonym, dimensions, resources, attributes):
    children = []
    for kind, fields in (("Dimension", dimensions), ("Resource", resources), ("Attribute", attributes)):
        for field_name, title, type_xml in fields:
            children.append(f'<{kind} uuid="{uid(name + "." + field_name)}">'
                            + field_properties(field_name, title, type_xml, dimension=(kind == "Dimension"))
                            + f"</{kind}>")
    types = generated_types("InformationRegister", name, [
        ("InformationRegisterRecord", "Record"), ("InformationRegisterManager", "Manager"),
        ("InformationRegisterSelection", "Selection"), ("InformationRegisterList", "List"),
        ("InformationRegisterRecordSet", "RecordSet"), ("InformationRegisterRecordKey", "RecordKey"),
        ("InformationRegisterRecordManager", "RecordManager"),
    ])
    write(out / "InformationRegisters" / f"{name}.xml",
          HEADER + f'<InformationRegister uuid="{uid(name)}">{types}'
          f"<Properties><Name>{name}</Name><Synonym>{text(synonym)}</Synonym><Comment/>"
          "<UseStandardCommands>true</UseStandardCommands><EditType>InDialog</EditType><DefaultRecordForm/>"
          "<DefaultListForm/><AuxiliaryRecordForm/><AuxiliaryListForm/>"
          "<InformationRegisterPeriodicity>Nonperiodical</InformationRegisterPeriodicity><WriteMode>Independent</WriteMode>"
          "<MainFilterOnPeriod>false</MainFilterOnPeriod><IncludeHelpInContents>false</IncludeHelpInContents>"
          "<DataLockControlMode>Managed</DataLockControlMode><FullTextSearch>DontUse</FullTextSearch>"
          "<EnableTotalsSliceFirst>false</EnableTotalsSliceFirst><EnableTotalsSliceLast>false</EnableTotalsSliceLast>"
          "<RecordPresentation/><ExtendedRecordPresentation/><ListPresentation/><ExtendedListPresentation/><Explanation/>"
          "<DataHistory>DontUse</DataHistory><UpdateDataHistoryImmediatelyAfterWrite>false</UpdateDataHistoryImmediatelyAfterWrite>"
          "<ExecuteAfterWriteDataHistoryVersionProcessing>false</ExecuteAfterWriteDataHistoryVersionProcessing>"
          f"</Properties><ChildObjects>{''.join(children)}</ChildObjects></InformationRegister></MetaDataObject>")


SETTINGS_REGISTER = "ИМ_ТоварыСайта"
PHOTO_REGISTER = "ИМ_ФотоТоваров"
SETTINGS_SHOP_REGISTER = "ИМ_НастройкиМагазина"


def build_registers(out):
    build_register(
        out, SETTINGS_REGISTER, "Товары сайта (настройки)",
        [("Номенклатура", "Номенклатура", t_nomenclature())],
        [("Скрыть", "Скрыть с сайта", t_bool()),
         ("Наличие", "Наличие на сайте", t_str(20)),
         ("ЦенаСайта", "Цена на сайте", t_num(15, 2)),
         ("СтараяЦена", "Старая цена", t_num(15, 2)),
         ("Распродажа", "Распродажа", t_bool()),
         ("ТоварДня", "Товар дня", t_bool()),
         ("Хит", "Хит", t_bool()),
         ("Новинка", "Новинка", t_bool()),
         ("СтоимостьДоставки", "Стоимость доставки", t_num(15, 2))],
        [("ДатаИзменения", "Дата изменения", t_date()),
         ("Пользователь", "Пользователь", t_str(100))],
    )
    build_register(
        out, SETTINGS_SHOP_REGISTER, "Настройки заказов с сайта",
        [("Ключ", "Ключ", t_str(50))],
        [("Включено", "Загружать заказы с сайта", t_bool()),
         ("Организация", "Организация", t_catalog("Организации")),
         ("Склад", "Склад", t_catalog("Склады")),
         ("Касса", "Касса для оплат O!Деньги", t_catalog("Кассы")),
         ("Соглашение", "Соглашение с клиентами", t_catalog("СоглашенияСКлиентами")),
         ("УслугаДоставки", "Услуга «Доставка»", t_catalog("Номенклатура")),
         ("АдресСервера", "Адрес сервера", t_str(200)),
         ("КлючAPI", "Ключ API", t_str(200))],
        [],
    )
    build_register(
        out, PHOTO_REGISTER, "Фото товаров сайта",
        [("Номенклатура", "Номенклатура", t_nomenclature()),
         ("Номер", "Номер", t_num(3))],
        [("Главное", "Главное фото", t_bool())],
        [("Картинка", "Картинка", t_storage()),
         ("ДатаИзменения", "Дата изменения", t_date())],
    )


# ── Конструктор управляемых форм ─────────────────────────────────────────────

class Form:
    def __init__(self):
        self._id = 0
        self._attr_id = 0
        self._cmd_id = 0
        self.attributes = []
        self.commands = []
        self.parameters = []

    def next_id(self):
        self._id += 1
        return self._id

    def _tail(self, name):
        return (f'<ContextMenu name="{name}КонтекстноеМеню" id="{self.next_id()}"/>'
                f'<ExtendedTooltip name="{name}РасширеннаяПодсказка" id="{self.next_id()}"/>')

    @staticmethod
    def _events(events):
        if not events:
            return ""
        return "<Events>" + "".join(f'<Event name="{k}">{v}</Event>' for k, v in events.items()) + "</Events>"

    def input(self, name, path, readonly=False, title_location=None, width=None, height=None,
              stretch=None, choices=None, hint=None, events=None, table=False, title=None, negatives=False,
              password=False):
        props = f"<DataPath>{path}</DataPath>"
        if title:
            props += f"<Title>{text(title)}</Title>"
        if readonly:
            props += "<ReadOnly>true</ReadOnly>"
        if title_location:
            props += f"<TitleLocation>{title_location}</TitleLocation>"
        if table:
            props += "<EditMode>EnterOnInput</EditMode>"
        if password:
            props += "<PasswordMode>true</PasswordMode>"
        if width:
            props += f"<Width>{width}</Width>"
        if height:
            props += f"<Height>{height}</Height>"
        if stretch is not None:
            props += f"<HorizontalStretch>{str(stretch).lower()}</HorizontalStretch>"
        if negatives:
            props += "<MarkNegatives>true</MarkNegatives>"
        if choices:
            items = "".join(
                '<xr:Item><xr:Presentation/><xr:CheckState>0</xr:CheckState><xr:Value xsi:type="FormChoiceListDesTimeValue">'
                f'<Presentation>{text(v)}</Presentation><Value xsi:type="xs:string">{escape(v)}</Value></xr:Value></xr:Item>'
                for v in choices)
            props += f"<ListChoiceMode>true</ListChoiceMode><ChoiceList>{items}</ChoiceList>"
        if hint:
            props += f"<InputHint>{text(hint)}</InputHint>"
        return (f'<InputField name="{name}" id="{self.next_id()}">{props}'
                f"{self._tail(name)}{self._events(events)}</InputField>")

    def check(self, name, path, readonly=False, title_location=None, events=None, table=False):
        props = f"<DataPath>{path}</DataPath>"
        if readonly:
            props += "<ReadOnly>true</ReadOnly>"
        if title_location:
            props += f"<TitleLocation>{title_location}</TitleLocation>"
        if table:
            props += "<EditMode>EnterOnInput</EditMode>"
        props += "<CheckBoxType>Auto</CheckBoxType>"
        return (f'<CheckBoxField name="{name}" id="{self.next_id()}">{props}'
                f"{self._tail(name)}{self._events(events)}</CheckBoxField>")

    def picture(self, name, path, width, height):
        return (f'<PictureField name="{name}" id="{self.next_id()}"><DataPath>{path}</DataPath>'
                f"<TitleLocation>None</TitleLocation><Width>{width}</Width><Height>{height}</Height>"
                "<AutoMaxWidth>false</AutoMaxWidth><AutoMaxHeight>false</AutoMaxHeight>"
                "<PictureSize>Proportionally</PictureSize>"
                f"{self._tail(name)}</PictureField>")

    def html(self, name, path, width, height, events=None):
        return (f'<HTMLDocumentField name="{name}" id="{self.next_id()}"><DataPath>{path}</DataPath>'
                f"<TitleLocation>None</TitleLocation><Width>{width}</Width><Height>{height}</Height>"
                f"{self._tail(name)}{self._events(events)}</HTMLDocumentField>")

    def button(self, name, command, bar=False, default=False):
        kind = "CommandBarButton" if bar else "UsualButton"
        default_xml = "<DefaultButton>true</DefaultButton>" if default else ""
        return (f'<Button name="{name}" id="{self.next_id()}"><Type>{kind}</Type>{default_xml}'
                f"<CommandName>Form.Command.{command}</CommandName>"
                f'<ExtendedTooltip name="{name}РасширеннаяПодсказка" id="{self.next_id()}"/></Button>')

    def group(self, name, children, direction="Vertical", title=None):
        title_xml = f"<Title>{text(title)}</Title>" if title else ""
        show = "true" if title else "false"
        representation = "NormalSeparation" if title else "None"
        return (f'<UsualGroup name="{name}" id="{self.next_id()}">{title_xml}<Group>{direction}</Group>'
                f"<Behavior>Usual</Behavior><Representation>{representation}</Representation><ShowTitle>{show}</ShowTitle>"
                f'<ExtendedTooltip name="{name}РасширеннаяПодсказка" id="{self.next_id()}"/>'
                f"<ChildItems>{''.join(children)}</ChildItems></UsualGroup>")

    def table(self, name, path, columns, bar_buttons=(), events=None, height=None, search=True):
        def addition(tag, kind):
            element = f"{name}{kind}"
            return (f'<{tag} name="{element}" id="{self.next_id()}"><AdditionSource><Item>{name}</Item>'
                    f"<Type>{kind}</Type></AdditionSource>{self._tail(element)}</{tag}>")

        height_xml = f"<HeightInTableRows>{height}</HeightInTableRows>" if height else ""
        search_xml = "" if search else (
            "<SearchStringLocation>None</SearchStringLocation><ViewStatusLocation>None</ViewStatusLocation>"
            "<SearchControlLocation>None</SearchControlLocation>")
        bar = (f'<AutoCommandBar name="{name}КоманднаяПанель" id="{self.next_id()}">'
               f"<ChildItems>{''.join(bar_buttons)}</ChildItems></AutoCommandBar>")
        return (
            f'<Table name="{name}" id="{self.next_id()}"><Representation>List</Representation>'
            "<ChangeRowSet>false</ChangeRowSet><ChangeRowOrder>false</ChangeRowOrder>"
            f"{height_xml}<AutoInsertNewRow>false</AutoInsertNewRow><DataPath>{path}</DataPath>"
            f'{search_xml}<RowFilter xsi:nil="true"/>'
            f'<ContextMenu name="{name}КонтекстноеМеню" id="{self.next_id()}"/>{bar}'
            f'<ExtendedTooltip name="{name}РасширеннаяПодсказка" id="{self.next_id()}"/>'
            + addition("SearchStringAddition", "SearchStringRepresentation")
            + addition("ViewStatusAddition", "ViewStatusRepresentation")
            + addition("SearchControlAddition", "SearchControl")
            + self._events(events)
            + f"<ChildItems>{''.join(columns)}</ChildItems></Table>"
        )

    def attribute(self, name, type_xml, title=None, main=False, save=False, saved_data=False, columns=None):
        self._attr_id += 1
        xml = f'<Attribute name="{name}" id="{self._attr_id}">'
        if title:
            xml += f"<Title>{text(title)}</Title>"
        xml += f"<Type>{type_xml}</Type>"
        if main:
            xml += "<MainAttribute>true</MainAttribute>"
        if saved_data:
            xml += "<SavedData>true</SavedData>"
        if save:
            xml += f"<Save><Field>{name}</Field></Save>"
        if columns:
            xml += "<Columns>" + "".join(
                f'<Column name="{c}" id="{i}"><Title>{text(t)}</Title><Type>{ct}</Type></Column>'
                for i, (c, t, ct) in enumerate(columns, 1)) + "</Columns>"
        self.attributes.append(xml + "</Attribute>")

    def command(self, name, title, tooltip):
        self._cmd_id += 1
        self.commands.append(f'<Command name="{name}" id="{self._cmd_id}"><Title>{text(title)}</Title>'
                             f"<ToolTip>{text(tooltip)}</ToolTip><Action>{name}</Action></Command>")

    def parameter(self, name, type_xml):
        self.parameters.append(f'<Parameter name="{name}"><Type>{type_xml}</Type></Parameter>')

    def render(self, title, items, events, bar_buttons=(), save_settings=False):
        bar = (f'<AutoCommandBar name="ФормаКоманднаяПанель" id="-1"><ChildItems>{"".join(bar_buttons)}</ChildItems></AutoCommandBar>'
               if bar_buttons else '<AutoCommandBar name="ФормаКоманднаяПанель" id="-1"/>')
        return (
            FORM_HEADER + f"<Title>{text(title)}</Title><AutoTitle>false</AutoTitle>"
            + ("<AutoSaveDataInSettings>Use</AutoSaveDataInSettings>" if save_settings else "")
            + bar + self._events(events)
            + f"<ChildItems>{''.join(items)}</ChildItems>"
            + f"<Attributes>{''.join(self.attributes)}</Attributes>"
            + f"<Commands>{''.join(self.commands)}</Commands>"
            + (f"<Parameters>{''.join(self.parameters)}</Parameters>" if self.parameters else "")
            + "</Form>"
        )


PROCESSOR = "ИМ_ОнлайнМагазин"
AVAILABILITY = ["По остатку", "В наличии", "Нет в наличии"]


def list_form():
    """Список товаров: быстрые правки в таблице, двойной щелчок — карточка с фото."""
    f = Form()
    columns = [
        ("Номенклатура", "Товар", t_nomenclature()),
        ("Код", "Код", t_str(20)),
        ("Артикул", "Артикул", t_str(100)),
        ("ГруппаТовара", "Группа", t_str(150)),
        ("Остаток", "Остаток", t_num(15, 3, "Any")),
        ("Себестоимость", "Себестоимость", t_num(15, 2)),
        ("Фото", "Фото", t_num(3)),
        ("Скрыть", "Скрыть", t_bool()),
        ("Наличие", "Наличие на сайте", t_str(20)),
        ("ЦенаСайта", "Цена на сайте", t_num(15, 2)),
        ("СтараяЦена", "Старая цена", t_num(15, 2)),
        ("Скидка", "Скидка %", t_num(3)),
        ("Маржа", "Маржа, сом", t_num(15, 2, "Any")),
        ("МаржаПроцент", "Маржа, %", t_num(5, 1, "Any")),
        ("Распродажа", "Распродажа", t_bool()),
        ("ТоварДня", "Товар дня", t_bool()),
        ("Хит", "Хит", t_bool()),
        ("Новинка", "Новинка", t_bool()),
        ("СтоимостьДоставки", "Доставка, сом", t_num(15, 2)),
        ("Изменено", "Изменено", t_bool()),
    ]
    f.attribute("Объект", f"<v8:Type>cfg:DataProcessorObject.{PROCESSOR}</v8:Type>", main=True)
    f.attribute("Товары", "<v8:Type>v8:ValueTable</v8:Type>", title="Товары", columns=columns)
    f.attribute("Поиск", t_str(100), title="Поиск")
    f.attribute("ТолькоВНаличии", t_bool(), title="Только в наличии", save=True)
    f.attribute("Итог", t_str(0), title="Итог")
    f.attribute("ЕстьСебестоимость", t_bool())
    for name, title, tip in [
        ("Обновить", "Обновить", "Заново загрузить товары, остатки и себестоимость из 1С"),
        ("Сохранить", "Сохранить для сайта", "Записать изменения, которые увидит сайт"),
        ("ОткрытьКарточкуТовара", "Карточка и фото", "Открыть карточку товара: настройки и фото"),
        ("СкрытьВыделенные", "Скрыть выделенные", "Скрыть выделенные товары с сайта"),
        ("ПоказатьВыделенные", "Показать выделенные", "Вернуть выделенные товары на сайт"),
        ("ОткрытьНастройкиЗаказов", "Настройки заказов с сайта", "Организация, склад, касса O!Деньги для оплаченных заказов"),
        ("ОтправитьКаталогНаСайт", "Отправить на сайт сейчас", "Не ждать 10 минут — отправить товары, цены и фото на сайт"),
    ]:
        f.command(name, title, tip)

    table_columns = [
        f.input("ТоварыНоменклатура", "Товары.Номенклатура", readonly=True, width=36, table=True),
        f.input("ТоварыКод", "Товары.Код", readonly=True, width=8, table=True),
        f.input("ТоварыГруппа", "Товары.ГруппаТовара", readonly=True, width=16, table=True),
        f.input("ТоварыОстаток", "Товары.Остаток", readonly=True, width=7, table=True),
        f.input("ТоварыСебестоимость", "Товары.Себестоимость", readonly=True, width=10, table=True),
        f.input("ТоварыЦенаСайта", "Товары.ЦенаСайта", width=10, table=True),
        f.input("ТоварыСтараяЦена", "Товары.СтараяЦена", width=10, table=True),
        f.input("ТоварыСкидка", "Товары.Скидка", readonly=True, width=6, table=True),
        f.input("ТоварыМаржа", "Товары.Маржа", readonly=True, width=10, table=True, negatives=True),
        f.input("ТоварыМаржаПроцент", "Товары.МаржаПроцент", readonly=True, width=7, table=True, negatives=True),
        f.input("ТоварыФото", "Товары.Фото", readonly=True, width=5, table=True),
        f.check("ТоварыСкрыть", "Товары.Скрыть", table=True),
        f.input("ТоварыНаличие", "Товары.Наличие", width=12, choices=AVAILABILITY, table=True),
        f.check("ТоварыРаспродажа", "Товары.Распродажа", table=True),
        f.check("ТоварыТоварДня", "Товары.ТоварДня", table=True),
        f.check("ТоварыХит", "Товары.Хит", table=True),
        f.check("ТоварыНовинка", "Товары.Новинка", table=True),
        f.input("ТоварыСтоимостьДоставки", "Товары.СтоимостьДоставки", width=8, table=True),
    ]
    items = [
        f.group("ГруппаОтбор", [
            f.input("Поиск", "Поиск", hint="Название, артикул или код"),
            f.check("ТолькоВНаличии", "ТолькоВНаличии", title_location="Right"),
            f.button("ФормаОбновить", "Обновить"),
            f.button("ФормаСохранить", "Сохранить", default=True),
            f.button("ФормаОтправитьНаСайт", "ОтправитьКаталогНаСайт"),
            f.button("ФормаНастройкиЗаказов", "ОткрытьНастройкиЗаказов"),
        ], direction="AlwaysHorizontal"),
        f.input("Итог", "Итог", readonly=True, title_location="None"),
        f.table("Товары", "Товары", table_columns, bar_buttons=[
            f.button("ТоварыОткрытьКарточку", "ОткрытьКарточкуТовара", bar=True),
            f.button("ТоварыСкрытьВыделенные", "СкрытьВыделенные", bar=True),
            f.button("ТоварыПоказатьВыделенные", "ПоказатьВыделенные", bar=True),
        ], events={"Selection": "ТоварыВыбор", "OnChange": "ТоварыПриИзменении"}),
    ]
    return f.render("Онлайн магазин", items,
                    {"OnCreateAtServer": "ПриСозданииНаСервере", "BeforeClose": "ПередЗакрытием",
                     "OnLoadDataFromSettingsAtServer": "ПриЗагрузкеДанныхИзНастроекНаСервере"},
                    save_settings=True)


def card_form():
    """Карточка товара: фото слева (просмотр + список), настройки сайта справа."""
    f = Form()
    f.parameter("Номенклатура", t_nomenclature())
    f.attribute("Объект", f"<v8:Type>cfg:DataProcessorObject.{PROCESSOR}</v8:Type>", main=True)
    f.attribute("Номенклатура", t_nomenclature(), title="Товар")
    f.attribute("Сводка", t_str(0))
    for name, title, type_xml in [
        ("Скрыть", "Скрыть с сайта", t_bool()),
        ("Наличие", "Наличие на сайте", t_str(20)),
        ("ЦенаСайта", "Цена на сайте", t_num(15, 2)),
        ("СтараяЦена", "Старая цена (зачёркнутая)", t_num(15, 2)),
        ("Распродажа", "Распродажа", t_bool()),
        ("ТоварДня", "Товар дня", t_bool()),
        ("Хит", "Хит", t_bool()),
        ("Новинка", "Новинка", t_bool()),
        ("СтоимостьДоставки", "Доставка, сом", t_num(15, 2)),
    ]:
        f.attribute(name, type_xml, title=title, saved_data=True)
    f.attribute("Себестоимость", t_num(15, 2), title="Себестоимость")
    f.attribute("Маржа", t_num(15, 2, "Any"), title="Маржа, сом")
    f.attribute("МаржаПроцент", t_num(5, 1, "Any"), title="Маржа, %")
    f.attribute("Остаток", t_num(15, 3, "Any"), title="Остаток")
    f.attribute("Скидка", t_num(3), title="Скидка, %")
    f.attribute("Фото", "<v8:Type>v8:ValueTable</v8:Type>", title="Фото", columns=[
        ("Номер", "№", t_num(3)),
        ("Главное", "Главное", t_bool()),
        ("Описание", "Фото", t_str(100)),
        ("Адрес", "Адрес", t_str(0)),
    ])
    f.attribute("АдресПросмотра", t_str(0))
    f.attribute("Записано", t_bool())
    for name, title, tip in [
        ("ЗаписатьИЗакрыть", "Сохранить и закрыть", "Сохранить настройки и фото для сайта и закрыть"),
        ("Записать", "Сохранить", "Сохранить настройки и фото для сайта"),
        ("ДобавитьФото", "Добавить фото", "Выбрать одно или несколько фото с компьютера"),
        ("РедактироватьФото", "Обрезать / изменить", "Открыть редактор: обрезка, масштаб, поворот"),
        ("СделатьГлавным", "Сделать главным", "Это фото будет первым на сайте"),
        ("ФотоВыше", "Выше", "Переместить фото выше"),
        ("ФотоНиже", "Ниже", "Переместить фото ниже"),
        ("УдалитьФото", "Удалить фото", "Удалить выбранное фото"),
    ]:
        f.command(name, title, tip)

    change = {"OnChange": "НастройкаПриИзменении"}
    price_change = {"OnChange": "ЦенаПриИзменении"}
    photos = f.group("ГруппаФото", [
        f.picture("Просмотр", "АдресПросмотра", width=46, height=18),
        f.table("Фото", "Фото", [
            f.input("ФотоНомер", "Фото.Номер", readonly=True, width=3, table=True),
            f.input("ФотоОписание", "Фото.Описание", readonly=True, width=30, table=True),
        ], bar_buttons=[
            f.button("ФотоДобавить", "ДобавитьФото", bar=True),
            f.button("ФотоРедактировать", "РедактироватьФото", bar=True),
            f.button("ФотоСделатьГлавным", "СделатьГлавным", bar=True),
            f.button("ФотоКнопкаВыше", "ФотоВыше", bar=True),
            f.button("ФотоКнопкаНиже", "ФотоНиже", bar=True),
            f.button("ФотоУдалить", "УдалитьФото", bar=True),
        ], events={"OnActivateRow": "ФотоПриАктивизацииСтроки", "Selection": "ФотоВыбор"},
            height=5, search=False),
    ], title="Фото для сайта")
    settings = f.group("ГруппаНастройки", [
        f.check("Скрыть", "Скрыть", title_location="Right", events=change),
        f.input("Наличие", "Наличие", width=16, choices=AVAILABILITY, events=change),
        f.input("Себестоимость", "Себестоимость", readonly=True, width=12),
        f.input("ЦенаСайта", "ЦенаСайта", width=12, events=price_change, hint="ваша цена"),
        f.input("СтараяЦена", "СтараяЦена", width=12, events=price_change, hint="для скидки"),
        f.input("Скидка", "Скидка", readonly=True, width=6),
        f.input("Маржа", "Маржа", readonly=True, width=12, negatives=True),
        f.input("МаржаПроцент", "МаржаПроцент", readonly=True, width=7, negatives=True),
        f.input("СтоимостьДоставки", "СтоимостьДоставки", width=12, events=change, hint="0 — бесплатно"),
        f.check("Распродажа", "Распродажа", title_location="Right", events=change),
        f.check("ТоварДня", "ТоварДня", title_location="Right", events=change),
        f.check("Хит", "Хит", title_location="Right", events=change),
        f.check("Новинка", "Новинка", title_location="Right", events=change),
    ], title="На сайте")
    items = [
        f.input("Номенклатура", "Номенклатура", readonly=True, stretch=True),
        f.input("Сводка", "Сводка", readonly=True, title_location="None", stretch=True),
        f.group("ГруппаОсновная", [photos, settings], direction="AlwaysHorizontal"),
    ]
    return f.render("Карточка товара", items,
                    {"OnCreateAtServer": "ПриСозданииНаСервере", "BeforeClose": "ПередЗакрытием"},
                    bar_buttons=[
                        f.button("ФормаЗаписатьИЗакрыть", "ЗаписатьИЗакрыть", bar=True, default=True),
                        f.button("ФормаЗаписать", "Записать", bar=True),
                    ])


def editor_form():
    """Редактор фото: HTML-поле с холстом (обрезка, масштаб, поворот, белый фон)."""
    f = Form()
    f.parameter("АдресКартинки", t_str(0))
    f.parameter("ИдентификаторВладельца", t_uuid())
    f.attribute("Объект", f"<v8:Type>cfg:DataProcessorObject.{PROCESSOR}</v8:Type>", main=True)
    f.attribute("ТекстHTML", t_str(0))
    f.attribute("Готово", t_bool())
    f.attribute("ИдентификаторВладельца", t_uuid())
    f.command("Применить", "Готово — сохранить фото", "Обрезать и сохранить фото для сайта")
    f.command("Отмена", "Отмена", "Закрыть без изменений")
    items = [f.html("Редактор", "ТекстHTML", width=120, height=34, events={"DocumentComplete": "РедакторДокументСформирован"})]
    return f.render("Редактор фото", items, {"OnCreateAtServer": "ПриСозданииНаСервере"},
                    bar_buttons=[
                        f.button("ФормаПрименить", "Применить", bar=True, default=True),
                        f.button("ФормаОтмена", "Отмена", bar=True),
                    ])


def settings_form():
    """Настройки заказов с сайта: куда 1С оформляет оплаченные заказы."""
    f = Form()
    f.attribute("Объект", f"<v8:Type>cfg:DataProcessorObject.{PROCESSOR}</v8:Type>", main=True)
    for name, title, type_xml in [
        ("Включено", "Обмен с сайтом включён (заказы и каталог)", t_bool()),
        ("Организация", "Организация", t_catalog("Организации")),
        ("Склад", "Склад отгрузки", t_catalog("Склады")),
        ("Касса", "Касса для оплат O!Деньги", t_catalog("Кассы")),
        ("Соглашение", "Соглашение с клиентами", t_catalog("СоглашенияСКлиентами")),
        ("УслугаДоставки", "Услуга «Доставка»", t_catalog("Номенклатура")),
        ("АдресСервера", "Адрес сервера", t_str(200)),
        ("КлючAPI", "Ключ API", t_str(200)),
    ]:
        f.attribute(name, type_xml, title=title, saved_data=True)
    f.attribute("Состояние", t_str(0), title="Состояние")
    for name, title, tip in [
        ("ЗаписатьИЗакрыть", "Сохранить и закрыть", "Сохранить настройки"),
        ("Записать", "Сохранить", "Сохранить настройки"),
        ("ПроверитьСвязь", "Проверить связь", "Проверить соединение с сервером заказов"),
        ("ЗагрузитьСейчас", "Загрузить заказы сейчас", "Не ждать 5 минут — забрать оплаченные заказы сейчас"),
        ("ОтправитьКаталог", "Отправить каталог сейчас", "Не ждать 10 минут — отправить товары, цены и фото на сайт"),
    ]:
        f.command(name, title, tip)
    items = [
        f.check("Включено", "Включено", title_location="Right"),
        f.group("ГруппаДокументы", [
            f.input("Организация", "Организация", width=40),
            f.input("Склад", "Склад", width=40),
            f.input("Касса", "Касса", width=40, hint="по умолчанию «О! Business»"),
            f.input("Соглашение", "Соглашение", width=40, hint="пусто — как в последней продаже"),
            f.input("УслугаДоставки", "УслугаДоставки", width=40, hint="нужна, если доставка платная"),
        ], title="Документы в 1С"),
        f.group("ГруппаСервер", [
            f.input("АдресСервера", "АдресСервера", width=40, hint="пусто — как у SBonus"),
            f.input("КлючAPI", "КлючAPI", width=40, hint="пусто — ключ SBonus", password=True),
        ], title="Сервер заказов"),
        f.input("Состояние", "Состояние", readonly=True, title_location="None", stretch=True, height=3),
        f.group("ГруппаКнопки", [
            f.button("КнопкаПроверитьСвязь", "ПроверитьСвязь"),
            f.button("КнопкаЗагрузитьСейчас", "ЗагрузитьСейчас"),
            f.button("КнопкаОтправитьКаталог", "ОтправитьКаталог"),
        ], direction="AlwaysHorizontal"),
    ]
    return f.render("Настройки заказов с сайта", items, {"OnCreateAtServer": "ПриСозданииНаСервере"},
                    bar_buttons=[
                        f.button("ФормаЗаписатьИЗакрыть", "ЗаписатьИЗакрыть", bar=True, default=True),
                        f.button("ФормаЗаписать", "Записать", bar=True),
                    ])


FORMS = [
    ("Форма", "Онлайн магазин", list_form, "ФормаМодуль.bsl"),
    ("КарточкаТовара", "Карточка товара", card_form, "КарточкаТовараМодуль.bsl"),
    ("РедакторФото", "Редактор фото", editor_form, "РедакторФотоМодуль.bsl"),
    ("НастройкиМагазина", "Настройки заказов с сайта", settings_form, "НастройкиМагазинаМодуль.bsl"),
]
TEMPLATES = [("РедакторФото", "Редактор фото (HTML)", "РедакторФото.html")]


def build_processor(out):
    types = generated_types("DataProcessor", PROCESSOR, [("DataProcessorObject", "Object"), ("DataProcessorManager", "Manager")])
    children = "".join(f"<Form>{name}</Form>" for name, *_ in FORMS)
    children += "".join(f"<Template>{name}</Template>" for name, *_ in TEMPLATES)
    base = out / "DataProcessors"
    write(base / f"{PROCESSOR}.xml",
          HEADER + f'<DataProcessor uuid="{uid(PROCESSOR)}">{types}'
          f"<Properties><Name>{PROCESSOR}</Name><Synonym>{text('Онлайн магазин')}</Synonym><Comment/>"
          f"<UseStandardCommands>true</UseStandardCommands><DefaultForm>DataProcessor.{PROCESSOR}.Form.Форма</DefaultForm>"
          "<AuxiliaryForm/><IncludeHelpInContents>false</IncludeHelpInContents><ExtendedPresentation/><Explanation/>"
          f"</Properties><ChildObjects>{children}</ChildObjects></DataProcessor></MetaDataObject>")

    for name, synonym, builder, module in FORMS:
        form_dir = base / PROCESSOR / "Forms"
        # uuid формы «Форма» сохраняем прежним, чтобы не терять пользовательские настройки.
        key = PROCESSOR + ".Form." + name
        write(form_dir / f"{name}.xml",
              HEADER + f'<Form uuid="{uid(key)}"><Properties><Name>{name}</Name>'
              f"<Synonym>{text(synonym)}</Synonym><Comment/><FormType>Managed</FormType>"
              "<IncludeHelpInContents>false</IncludeHelpInContents><UsePurposes>"
              '<v8:Value xsi:type="app:ApplicationUsePurpose">PlatformApplication</v8:Value>'
              "</UsePurposes><ExtendedPresentation/></Properties></Form></MetaDataObject>")
        write(form_dir / name / "Ext" / "Form.xml", builder())
        write(form_dir / name / "Ext" / "Form" / "Module.bsl", (SRC / module).read_text(encoding="utf-8-sig"))

    for name, synonym, source in TEMPLATES:
        template_dir = base / PROCESSOR / "Templates"
        write(template_dir / f"{name}.xml",
              HEADER + f'<Template uuid="{uid(PROCESSOR + ".Template." + name)}"><Properties><Name>{name}</Name>'
              f"<Synonym>{text(synonym)}</Synonym><Comment/><TemplateType>TextDocument</TemplateType>"
              "</Properties></Template></MetaDataObject>")
        write(template_dir / name / "Ext" / "Template.txt", (SRC / source).read_text(encoding="utf-8"))


COMMON_MODULE = "ИМ_ОнлайнМагазинСервер"
ORDERS_MODULE = "ИМ_ЗаказыСайтаСервер"
ORDERS_JOB = "ИМ_ЗагрузкаЗаказовСайта"
CATALOG_JOB = "ИМ_ОтправкаКаталогаНаСайт"


def build_common_module(out):
    build_module(out, COMMON_MODULE, "Онлайн магазин (сервер)", "ОбщийМодульСервер.bsl")
    build_module(out, ORDERS_MODULE, "Онлайн магазин: заказы с сайта", "ЗаказыСайтаСервер.bsl")
    write(out / "ScheduledJobs" / f"{ORDERS_JOB}.xml",
          HEADER + f'<ScheduledJob uuid="{uid("ScheduledJob." + ORDERS_JOB)}"><Properties><Name>{ORDERS_JOB}</Name>'
          f"<Synonym>{text('Онлайн магазин: загрузка оплаченных заказов с сайта')}</Synonym><Comment/>"
          f"<MethodName>CommonModule.{ORDERS_MODULE}.ЗагрузитьЗаказыСайта</MethodName><Description/><Key/>"
          "<Use>true</Use><Predefined>true</Predefined><RestartCountOnFailure>3</RestartCountOnFailure>"
          "<RestartIntervalOnFailure>60</RestartIntervalOnFailure></Properties></ScheduledJob></MetaDataObject>")
    write(out / "ScheduledJobs" / f"{CATALOG_JOB}.xml",
          HEADER + f'<ScheduledJob uuid="{uid("ScheduledJob." + CATALOG_JOB)}"><Properties><Name>{CATALOG_JOB}</Name>'
          f"<Synonym>{text('Онлайн магазин: отправка каталога и фото на сайт')}</Synonym><Comment/>"
          f"<MethodName>CommonModule.{ORDERS_MODULE}.ОтправитьКаталогНаСайтПоРасписанию</MethodName><Description/><Key/>"
          "<Use>true</Use><Predefined>true</Predefined><RestartCountOnFailure>3</RestartCountOnFailure>"
          "<RestartIntervalOnFailure>120</RestartIntervalOnFailure></Properties></ScheduledJob></MetaDataObject>")


def build_module(out, name, synonym, source):
    write(out / "CommonModules" / f"{name}.xml",
          HEADER + f'<CommonModule uuid="{uid("CommonModule." + name)}"><Properties>'
          f"<Name>{name}</Name><Synonym>{text(synonym)}</Synonym><Comment/>"
          "<Global>false</Global><ClientManagedApplication>false</ClientManagedApplication><Server>true</Server>"
          "<ExternalConnection>true</ExternalConnection><ClientOrdinaryApplication>false</ClientOrdinaryApplication>"
          "<ServerCall>false</ServerCall><Privileged>false</Privileged><ReturnValuesReuse>DontUse</ReturnValuesReuse>"
          "</Properties></CommonModule></MetaDataObject>")
    write(out / "CommonModules" / name / "Ext" / "Module.bsl",
          (SRC / source).read_text(encoding="utf-8-sig"))


# ── Подсистема, роль, заимствованные объекты, Configuration.xml ─────────────

def build_subsystem(out):
    # В разделе только обработка: регистры правятся через удобные формы, а не напрямую.
    write(out / "Subsystems" / f"{EXT}.xml",
          HEADER + f'<Subsystem uuid="{uid("Subsystem." + EXT)}"><Properties><Name>{EXT}</Name>'
          f"<Synonym>{text('Онлайн магазин')}</Synonym><Comment/><IncludeHelpInContents>true</IncludeHelpInContents>"
          "<IncludeInCommandInterface>true</IncludeInCommandInterface><UseOneCommand>false</UseOneCommand>"
          "<Explanation/><Picture/><Content>"
          f'<xr:Item xsi:type="xr:MDObjectRef">DataProcessor.{PROCESSOR}</xr:Item>'
          "</Content></Properties><ChildObjects/></Subsystem></MetaDataObject>")


ROLE = "ИМ_ОсновнаяРоль"


def build_role(out):
    write(out / "Roles" / f"{ROLE}.xml",
          HEADER + f'<Role uuid="{uid("Role." + ROLE)}"><Properties><Name>{ROLE}</Name>'
          f"<Synonym>{text('Онлайн магазин: управление сайтом')}</Synonym><Comment/></Properties></Role></MetaDataObject>")
    write(out / "Roles" / ROLE / "Ext" / "Rights.xml",
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<Rights xmlns="http://v8.1c.ru/8.2/roles" xmlns:xs="http://www.w3.org/2001/XMLSchema" '
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Rights" version="2.20">'
          "<setForNewObjects>true</setForNewObjects><setForAttributesByDefault>true</setForAttributesByDefault>"
          "<independentRightsOfChildObjects>false</independentRightsOfChildObjects></Rights>")


def build_adopted(out, variant):
    for name, code, ext_uuid in variant["languages"]:
        write(out / "Languages" / f"{name}.xml",
              HEADER + f'<Language uuid="{uid("Language." + name)}"><InternalInfo/><Properties>'
              f"<ObjectBelonging>Adopted</ObjectBelonging><Name>{name}</Name><Comment/>"
              f"<ExtendedConfigurationObject>{ext_uuid}</ExtendedConfigurationObject><LanguageCode>{code}</LanguageCode>"
              "</Properties></Language></MetaDataObject>")
    for catalog, ext_uuid in ADOPTED_CATALOGS.items():
        types = generated_types("Catalog", catalog, [
            ("CatalogObject", "Object"), ("CatalogRef", "Ref"), ("CatalogSelection", "Selection"),
            ("CatalogList", "List"), ("CatalogManager", "Manager"),
        ])
        write(out / "Catalogs" / f"{catalog}.xml",
              HEADER + f'<Catalog uuid="{uid("Catalog." + catalog)}">{types}<Properties>'
              f"<ObjectBelonging>Adopted</ObjectBelonging><Name>{catalog}</Name><Comment/>"
              f"<ExtendedConfigurationObject>{ext_uuid}</ExtendedConfigurationObject>"
              "</Properties><ChildObjects/></Catalog></MetaDataObject>")


CONTAINED_CLASS_IDS = [
    "9cd510cd-abfc-11d4-9434-004095e12fc7", "9fcd25a0-4822-11d4-9414-008048da11f9",
    "e3687481-0a87-462c-a166-9f34594f9bba", "9de14907-ec23-4a07-96f0-85521cb6b53b",
    "51f2d5d8-ea4d-4064-8892-82951750031e", "e68182ea-4237-4383-967f-90c1e3370bc7",
    "fb282519-d103-4dd3-bc12-cb271d631dfc",
]


def build_configuration(out, variant):
    contained = "".join(
        f"<xr:ContainedObject><xr:ClassId>{c}</xr:ClassId><xr:ObjectId>{uid('Contained.' + c)}</xr:ObjectId></xr:ContainedObject>"
        for c in CONTAINED_CLASS_IDS
    )
    children = "".join(f"<Language>{name}</Language>" for name, *_ in variant["languages"])
    children += (f"<Subsystem>{EXT}</Subsystem><Role>{ROLE}</Role>"
                 f"<CommonModule>{COMMON_MODULE}</CommonModule><CommonModule>{ORDERS_MODULE}</CommonModule>"
                 f"<ScheduledJob>{ORDERS_JOB}</ScheduledJob><ScheduledJob>{CATALOG_JOB}</ScheduledJob>"
                 + "".join(f"<Catalog>{c}</Catalog>" for c in ADOPTED_CATALOGS)
                 + f"<DataProcessor>{PROCESSOR}</DataProcessor>"
                 f"<InformationRegister>{SETTINGS_REGISTER}</InformationRegister>"
                 f"<InformationRegister>{PHOTO_REGISTER}</InformationRegister>"
                 f"<InformationRegister>{SETTINGS_SHOP_REGISTER}</InformationRegister>")
    write(out / "Configuration.xml",
          HEADER + f'<Configuration uuid="{uid("Configuration." + EXT)}"><InternalInfo>{contained}</InternalInfo>'
          "<Properties><ObjectBelonging>Adopted</ObjectBelonging>"
          f"<Name>{EXT}</Name><Synonym>{text('Онлайн магазин')}</Synonym><Comment/>"
          "<ConfigurationExtensionPurpose>AddOn</ConfigurationExtensionPurpose>"
          "<KeepMappingToExtendedConfigurationObjectsByIDs>false</KeepMappingToExtendedConfigurationObjectsByIDs>"
          "<NamePrefix>ИМ_</NamePrefix><ConfigurationExtensionCompatibilityMode>Version8_3_14</ConfigurationExtensionCompatibilityMode>"
          "<DefaultRunMode>ManagedApplication</DefaultRunMode><UsePurposes>"
          '<v8:Value xsi:type="app:ApplicationUsePurpose">PlatformApplication</v8:Value></UsePurposes>'
          "<ScriptVariant>Russian</ScriptVariant><DefaultRoles>"
          f'<xr:Item xsi:type="xr:MDObjectRef">Role.{ROLE}</xr:Item></DefaultRoles>'
          "<Vendor>Smart Centr</Vendor><Version>1.4.0.1</Version>"
          f"<DefaultLanguage>Language.{variant['default_language']}</DefaultLanguage>"
          "<BriefInformation/><DetailedInformation/><Copyright/><VendorInformationAddress/>"
          "<ConfigurationInformationAddress/><InterfaceCompatibilityMode>TaxiEnableVersion8_2</InterfaceCompatibilityMode>"
          f"</Properties><ChildObjects>{children}</ChildObjects></Configuration></MetaDataObject>")


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else ""
    if name not in VARIANTS:
        print("Укажите вариант конфигурации: python build_extension.py bas|ut")
        sys.exit(2)
    out = ROOT / "build" / name
    if out.exists():
        shutil.rmtree(out)
    variant = VARIANTS[name]
    build_configuration(out, variant)
    build_adopted(out, variant)
    build_registers(out)
    build_common_module(out)
    build_processor(out)
    build_subsystem(out)
    build_role(out)
    print(f"Готово: {out}")


if __name__ == "__main__":
    main()
