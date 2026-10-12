import QtQuick
import qs.modules.common.widgets

StyledText {
    // The popup can be scaled to fit the available screen/window size.
    // Qt rendering with no hinting avoids glyphs snapping between pixel grids.
    renderType: Text.QtRendering
    font.hintingPreference: Font.PreferNoHinting
    font.family: "Maple Mono"
    font.variableAxes: ({
    })
}
