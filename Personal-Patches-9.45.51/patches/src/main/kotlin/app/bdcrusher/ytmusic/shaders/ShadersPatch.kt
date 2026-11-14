/* Copyright 2026 BDCrusher. GPL-3.0. Native contracts inspected in original 9.42.52. */
package app.bdcrusher.ytmusic.shaders
import app.bdcrusher.ytmusic.nativeentry.personalRuntimePatch
import app.morphe.patcher.*
import app.morphe.patcher.patch.*
import app.morphe.patcher.extensions.InstructionExtensions.addInstruction
import app.morphe.patcher.extensions.InstructionExtensions.addInstructions
import app.morphe.patcher.extensions.InstructionExtensions.getInstruction
import app.morphe.patcher.extensions.InstructionExtensions.replaceInstruction
import app.morphe.patcher.util.proxy.mutableTypes.MutableMethod
import app.morphe.util.ResourceGroup
import app.morphe.util.copyResources
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.builder.MutableMethodImplementation
import com.android.tools.smali.dexlib2.iface.Method
import com.android.tools.smali.dexlib2.iface.instruction.*
import com.android.tools.smali.dexlib2.iface.reference.*
import com.android.tools.smali.dexlib2.immutable.ImmutableMethod

private const val SHADERS="Lapp/bdcrusher/ytmusic/shaders/ShaderRuntime;"
private object ShaderMetadata:Fingerprint(filters=listOf(methodCall(definingClass="Landroid/media/session/MediaSession;",name="setMetadata",parameters=listOf("Landroid/media/MediaMetadata;"))))
private object ShaderPlayback:Fingerprint(filters=listOf(methodCall(definingClass="Landroid/media/session/MediaSession;",name="setPlaybackState",parameters=listOf("Landroid/media/session/PlaybackState;"))))
private object ArtworkOwner:Fingerprint(name="<init>",filters=listOf(literal(0x7f0b0957L)))
private object BackgroundOwner:Fingerprint(name="<init>",filters=listOf(literal(0x7f0b094dL)))
private object ShaderPanelController:Fingerprint(strings=listOf("EngagementPanelController: cannot show EngagementPanel before EngagementPanelController.init() has been called.","[EngagementPanel] Cannot show EngagementPanel before EngagementPanelController.init() has been called."))
private object ShaderAssets
private val shaderAssets=resourcePatch {
    execute {
        copyResources("settings/music",ResourceGroup("drawable","bdcrusher_settings_shaders.xml","bdcrusher_settings_shaders_bold.xml"))
        for(name in listOf("index.html","shaders.js")){
            val target=this["assets/bdcrusher-shaders/$name"];target.parentFile.mkdirs()
            val input=ShaderAssets::class.java.classLoader!!.getResourceAsStream("bdcrusher-shaders/$name")?:throw PatchException("Build Shaders assets before packaging")
            input.use {i->target.outputStream().use {i.copyTo(it)}}
        }
        this["assets/bdcrusher-features/shaders.enabled"].apply {parentFile.mkdirs();writeText("1\n")}
    }
}
private fun Method.shaderCalls()=implementation?.instructions?.mapNotNull {((it as? ReferenceInstruction)?.reference as? MethodReference)}?:emptyList()
private fun Method.shaderReference()="$definingClass->$name(${parameterTypes.joinToString("")})$returnType"

@Suppress("unused")
val shadersPatch=bytecodePatch(name="Shaders",description="Animated covers and artwork backgrounds on the player and native Lyrics panel. Independent of personal lyrics.",default=false){
    category("Shaders")
    dependsOn(app.morphe.patches.music.misc.settings.settingsPatch, shaderAssets)
    compatibleWith(Compatibility(packageName="com.google.android.apps.youtube.music",name="YouTube Music",apkFileType=ApkFileType.APK_REQUIRED,
        targets=listOf(AppTarget(version="9.45.51",versionCodes=mapOf(SupportedAbi.ARM64_V8A to 94551240),minSdk=28,isExperimental=true))))
    execute {
        val shader=mutableClassDefBy(SHADERS);val originalId=shader.methods.single {it.name=="thumbnailId"};shader.methods.remove(originalId)
        val resourceId=0x7f0b0957
        val idMethod=MutableMethod(ImmutableMethod(SHADERS,"thumbnailId",emptyList(),"I",AccessFlags.PRIVATE.value or AccessFlags.STATIC.value,null,null,MutableMethodImplementation(1)))
        idMethod.addInstructions(0,"const v0, $resourceId\nreturn v0");shader.methods.add(idMethod)
        for((fingerprint,name,type) in listOf(Triple(ShaderMetadata,"onMetadata","Landroid/media/MediaMetadata;"),Triple(ShaderPlayback,"onPlayback","Landroid/media/session/PlaybackState;"))){
            fingerprint.clearMatch();val method=fingerprint.method;val index=fingerprint.instructionMatches.last().index
            val call=method.getInstruction<FiveRegisterInstruction>(index)
            method.addInstruction(index,"invoke-static { v${call.registerD} }, $SHADERS->$name($type)V")
        }
        val artworkOwner=ArtworkOwner;artworkOwner.clearMatch();val owner=artworkOwner.classDef
        val artwork=owner.methods.singleOrNull {m->m.parameterTypes==listOf("Landroid/graphics/Bitmap;")&&m.returnType=="V"&&m.shaderCalls().any {it.name=="setImageBitmap"&&it.parameterTypes==listOf("Landroid/graphics/Bitmap;")}}
            ?:throw PatchException("Native player artwork callback is missing or ambiguous")
        // Observe every return, including clearing artwork, without depending on an obfuscated name.
        val exits=artwork.implementation!!.instructions.withIndex().filter {it.value.opcode==Opcode.RETURN_VOID}.map {it.index}
        for(index in exits.reversed()){artwork.replaceInstruction(index,"invoke-static/range { p0 .. p1 }, $SHADERS->onArtwork(Landroid/view/View;Landroid/graphics/Bitmap;)V");artwork.addInstruction(index+1,"return-void")}
        val backgroundOwner=BackgroundOwner;backgroundOwner.clearMatch();val background=backgroundOwner.method
        val literal=background.implementation!!.instructions.indexOfFirst {(it as? WideLiteralInstruction)?.wideLiteral==0x7f0b094dL}
        val result=(literal+1 until minOf(literal+6,background.implementation!!.instructions.count())).singleOrNull {background.getInstruction<Instruction>(it).opcode==Opcode.MOVE_RESULT_OBJECT}
            ?:throw PatchException("Native player background view contract missing")
        val register=background.getInstruction<OneRegisterInstruction>(result).registerA
        background.addInstruction(result+1,"invoke-static { v$register }, $SHADERS->onPlayerBackground(Landroid/view/View;)V")

        ShaderPanelController.clearMatch();val controller=ShaderPanelController.classDef
        val types=controller.fields.filter {it.type.startsWith("L")&&!AccessFlags.STATIC.isSet(it.accessFlags)&&!AccessFlags.FINAL.isSet(it.accessFlags)}.map {it.type}
        val setter=controller.methods.singleOrNull {it.returnType=="V"&&it.parameterTypes.size==2&&it.parameterTypes[1]=="Z"&&it.parameterTypes[0] in types}?:throw PatchException("Native panel observer contract missing")
        val panelType=setter.parameterTypes[0].toString();val panel=classDefBy(panelType)
        val id=panel.methods.single {it.parameterTypes.isEmpty()&&it.returnType=="Ljava/lang/String;"}
        val root=panel.methods.single {it.parameterTypes.isEmpty()&&it.returnType=="Landroid/view/View;"}
        val runtime=mutableClassDefBy(SHADERS)
        for((name,call) in listOf("nativePanelId" to id,"nativePanelView" to root)){
            val old=runtime.methods.single {it.name==name};val method=MutableMethod(ImmutableMethod(old.definingClass,old.name,old.parameters,old.returnType,old.accessFlags,old.annotations,old.hiddenApiRestrictions,MutableMethodImplementation(2)))
            runtime.methods.remove(old);method.addInstructions(0,"check-cast p0, $panelType\ninvoke-interface { p0 }, ${call.shaderReference()}\nmove-result-object v0\nreturn-object v0");runtime.methods.add(method)
        }
        val assignment=setter.implementation!!.instructions.withIndex().singleOrNull {(_,i)->i.opcode==Opcode.IPUT_OBJECT&&((i as? ReferenceInstruction)?.reference as? FieldReference)?.let {it.definingClass==controller.type&&it.type==panelType}==true}?.index?:throw PatchException("Native current panel assignment missing")
        val assignmentRegisters = setter.getInstruction<TwoRegisterInstruction>(assignment)
        setter.addInstruction(assignment+1,
            "invoke-static { v${assignmentRegisters.registerB}, v${assignmentRegisters.registerA} }, $SHADERS->onNativePanel(Ljava/lang/Object;Ljava/lang/Object;)V")
    }
    finalize {
        val info=classDefByOrNull("Lapp/morphe/extension/music/shared/VideoInformation;")?:throw PatchException("Select Full Collection settings/defaults for Shaders")
        if(info.methods.none {it.name=="addVideoIdListener"})throw PatchException("Unsupported Morphe track identity contract for Shaders")
        var identityHook=false
        classDefForEach { c->if(c.type!=info.type&&c.methods.any {m->m.implementation?.instructions?.any {i->((i as? ReferenceInstruction)?.reference as? MethodReference)?.let {it.definingClass==info.type&&it.name=="setVideoId"}==true}==true})identityHook=true }
        if(!identityHook)throw PatchException("Shaders requires native video identity hooks. Select Full Collection settings/defaults.")
    }
}
