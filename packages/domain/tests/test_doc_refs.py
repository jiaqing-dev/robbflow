from robbflow_domain.doc_refs import parse_doc_url
from robbflow_domain.feishu_docs import InvalidDocLinkError


def test_feishu_via_doc_refs():
    parsed = parse_doc_url("https://my.feishu.cn/docx/AbCdEf123")
    assert parsed["provider"] == "feishu"
    assert parsed["kind"] == "docx"


def test_dingtalk_url():
    parsed = parse_doc_url("https://alidocs.dingtalk.com/i/nodes/abc")
    assert parsed["provider"] == "dingtalk"


def test_generic_https():
    parsed = parse_doc_url("https://example.com/spec.pdf")
    assert parsed["provider"] == "url"
    assert parsed["title"] == "spec.pdf"


def test_rejects_bare_text():
    try:
        parse_doc_url("不是链接")
        raise AssertionError("expected InvalidDocLinkError")
    except InvalidDocLinkError:
        pass
