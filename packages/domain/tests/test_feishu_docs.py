from robbflow_domain.feishu_docs import InvalidDocLinkError, parse_feishu_doc


def test_parses_docx_url():
    parsed = parse_feishu_doc("https://my.feishu.cn/docx/AbCdEf123")
    assert parsed["provider"] == "feishu"
    assert parsed["kind"] == "docx"
    assert parsed["title"] == "AbCdEf123"


def test_parses_wiki_url():
    parsed = parse_feishu_doc("https://company.larksuite.com/wiki/wikcnXXXX")
    assert parsed["kind"] == "wiki"
    assert parsed["provider"] == "feishu"


def test_rejects_non_feishu():
    try:
        parse_feishu_doc("https://notion.so/page")
        raise AssertionError("expected InvalidDocLinkError")
    except InvalidDocLinkError:
        pass


def test_rejects_bare_text():
    try:
        parse_feishu_doc("随便贴一段字")
        raise AssertionError("expected InvalidDocLinkError")
    except InvalidDocLinkError:
        pass
