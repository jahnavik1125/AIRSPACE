from ai_core import HandwritingRecognizer, IntentParser, MathRecognizer


def test_handwriting_recognizer_mock_inference():
    recognizer = HandwritingRecognizer()
    assert recognizer.load_model() is True
    res = recognizer.recognize_strokes([])
    assert res["text"] == ""
    assert "error" in res


def test_math_recognizer_mock_inference():
    recognizer = MathRecognizer()
    assert recognizer.load_model() is True
    res = recognizer.recognize_equation([])
    assert res["latex"] == ""
    assert "expression" in res


def test_intent_parser_mock():
    parser = IntentParser()
    res = parser.parse_intent([])
    assert res["intent"] == "UNKNOWN"
    assert res["confidence"] == 0.0
