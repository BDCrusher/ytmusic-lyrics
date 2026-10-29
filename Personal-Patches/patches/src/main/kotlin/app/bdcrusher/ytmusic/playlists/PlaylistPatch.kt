/* Copyright 2026 BDCrusher. GPL-3.0. Native contracts verified against original 9.42.52. */
package app.bdcrusher.ytmusic.playlists
import app.bdcrusher.ytmusic.nativeentry.personalRuntimePatch
import app.morphe.patcher.*
import app.morphe.patcher.patch.*
import app.morphe.patcher.extensions.InstructionExtensions.addInstruction
import app.morphe.patcher.extensions.InstructionExtensions.addInstructionsWithLabels
import app.morphe.patcher.util.proxy.mutableTypes.MutableMethod
import app.morphe.patches.music.misc.androidauto.*
import app.morphe.patches.music.interaction.downloads.CommandResolverFingerprint
import app.morphe.patches.music.interaction.jam.addBridge
import app.morphe.patches.music.interaction.jam.decode
import app.morphe.patches.music.interaction.jam.implementsType
import app.morphe.patches.music.interaction.jam.resolveProto
import app.morphe.util.cloneParameters
import app.morphe.util.getReference
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.iface.instruction.*
import com.android.tools.smali.dexlib2.iface.reference.*

private const val RUNTIME="Lapp/bdcrusher/ytmusic/playlists/PlaylistRuntime;"
private const val CLIENT="Lapp/bdcrusher/ytmusic/playlists/PlaylistRuntime\$PhoneClient;"
private const val RESPONSE="Lapp/bdcrusher/ytmusic/playlists/PlaylistRuntime\$PhoneResponse;"
private const val COMMAND="Lapp/bdcrusher/ytmusic/playlists/PlaylistRuntime\$CommandBytes;"
private object PlaylistHeader:Fingerprint(strings=listOf("com/google/android/apps/youtube/music/ui/presenter/MusicElementHeaderPresenter"))
private object PlaylistResources
private val playlistResources=resourcePatch {
    execute {
        val name="yt_outline_bdcrusher_download_playlist_vd_theme_24.xml"
        val target=this["res/drawable/$name"];target.parentFile.mkdirs()
        val input=PlaylistResources::class.java.classLoader!!.getResourceAsStream("bdcrusher-playlists/$name")?:throw PatchException("Playlist icon resource missing")
        input.use {i->target.outputStream().use {i.copyTo(it)}}
        this["assets/bdcrusher-features/playlists.enabled"].apply {parentFile.mkdirs();writeText("1\n")}
    }
}
@Suppress("unused")
val playlistDownloadsPatch=bytecodePatch(name="Download playlist",description="Adds a native playlist-header action using your existing Downloads mode, with durable in-app batches and ordered offline playlists.",default=false){
    category("Playlist downloads")
    dependsOn(personalRuntimePatch,playlistResources)
    compatibleWith(Compatibility(packageName="com.google.android.apps.youtube.music",name="YouTube Music",apkFileType=ApkFileType.APK_REQUIRED,
        targets=listOf(AppTarget(version="9.42.52",versionCodes=mapOf(SupportedAbi.ARM64_V8A to 94252240),minSdk=26,isExperimental=true),AppTarget(version="9.43.51",versionCodes=mapOf(SupportedAbi.ARM64_V8A to 94351240),minSdk=26,isExperimental=true))))
    execute {
        PlaylistHeader.clearMatch();val presenter=PlaylistHeader.classDef
        // The header factory consumes an extensible generated element and returns a byte-backed render model.
        val candidates=presenter.methods.flatMap {m->m.implementation?.instructions?.withIndex()?.mapNotNull { (index,i)->
            val ref=i.getReference<MethodReference>()?:return@mapNotNull null
            if(i.opcode!=Opcode.INVOKE_INTERFACE||ref.parameterTypes.size!=1||!ref.returnType.startsWith("L"))return@mapNotNull null
            val result=classDefByOrNull(ref.returnType)?:return@mapNotNull null
            if(result.fields.count {it.type=="[B"}!=1||!implementsType(ref.parameterTypes[0].toString(),"Lcom/google/protobuf/MessageLite;"))return@mapNotNull null
            Triple(m,index,ref)
        }?:emptyList()}
        val (original,index,factory)=candidates.singleOrNull()?:throw PatchException("Native playlist header factory missing or ambiguous")
        val proto=resolveProto(factory.parameterTypes.single().toString(),"playlist header element")
        val bridge=mutableClassDefBy(RUNTIME)
        bridge.addBridge("bd_rewriteHeader",listOf(proto.type),proto.type,4,AccessFlags.PUBLIC.value or AccessFlags.STATIC.value,"""
            invoke-virtual { p0 }, ${proto.type}->toByteArray()[B
            move-result-object p0
            invoke-static { p0 }, Lapp/bdcrusher/ytmusic/playlists/PlaylistHeaderModel;->rewrite([B)[B
            move-result-object p0
            ${proto.decode("p0","v0")}
            return-object v0
        """)
        val method=mutableClassDefBy(original.definingClass).methods.single {it.name==original.name&&it.parameterTypes==original.parameterTypes&&it.returnType==original.returnType}
        val call=method.implementation!!.instructions.elementAt(index) as FiveRegisterInstruction
        val register=call.registerD
        method.addInstruction(index,"invoke-static/range { v$register .. v$register }, $RUNTIME->bd_rewriteHeader(${proto.type})${proto.type}")
        method.addInstruction(index+1,"move-result-object v$register")

        PhoneBrowseRequestCallsFingerprint.clearMatch()
        val (create,setBrowse,tracking,send)=PhoneBrowseRequestCallsFingerprint.instructionMatches.mapNotNull {it.instruction.getReference<MethodReference>()}
        val nativeClient=mutableClassDefBy(create.definingClass);nativeClient.interfaces.add(CLIENT)
        nativeClient.addInterfaceMethod(findInterfaceMethod(CLIENT,"bd_playlistBrowse"),4,"""
            invoke-virtual { p0 }, $create
            move-result-object v0
            invoke-virtual { v0, p1 }, $setBrowse
            invoke-virtual { v0 }, $tracking
            invoke-virtual { p0, v0, p2 }, $send
            move-result-object v0
            return-object v0
        """)
        val continuation=phoneBrowseContinuationFingerprint(create.returnType).instructionMatches.last().instruction.getReference<FieldReference>()?:throw PatchException("Native playlist continuation field missing")
        nativeClient.addInterfaceMethod(findInterfaceMethod(CLIENT,"bd_playlistContinue"),4,"""
            invoke-virtual { p0 }, $create
            move-result-object v0
            iput-object p1, v0, $continuation
            invoke-virtual { v0 }, $tracking
            invoke-virtual { p0, v0, p2 }, $send
            move-result-object v0
            return-object v0
        """)
        for(ctor in nativeClient.methods.filter {it.name=="<init>"}){
            val exits=ctor.implementation!!.instructions.withIndex().filter {it.value.opcode==Opcode.RETURN_VOID}.map {it.index}
            for(exit in exits.reversed())ctor.addInstruction(exit,"invoke-static/range { p0 .. p0 }, $RUNTIME->capture($CLIENT)V")
        }
        PhoneBrowseResponseTabsFingerprint.clearMatch();val tabs=PhoneBrowseResponseTabsFingerprint.originalMethod
        val response=mutableClassDefBy(tabs.definingClass);response.interfaces.add(RESPONSE)
        val protoField=tabs.implementation!!.instructions.mapNotNull {it.getReference<FieldReference>()}.filter {it.definingClass==response.type&&implementsType(it.type,"Lcom/google/protobuf/MessageLite;")}.distinct().singleOrNull()
            ?:throw PatchException("Native authenticated playlist response bytes missing")
        response.addInterfaceMethod(findInterfaceMethod(RESPONSE,"bd_playlistBytes"),1,"""
            iget-object p0, p0, $protoField
            invoke-virtual { p0 }, ${protoField.type}->toByteArray()[B
            move-result-object p0
            return-object p0
        """)
    }
    finalize {
        CommandResolverFingerprint.clearMatch()
        if(CommandResolverFingerprint.method.implementation!!.instructions.none {i->i.getReference<MethodReference>()?.let {it.definingClass=="Lapp/morphe/extension/music/patches/DownloadsPatch;"&&it.name=="commandResolverOnClick"}==true})throw PatchException("Download playlist requires the Downloads patch to be selected in Full or official Morphe 1.48.0.")
        val manager=mutableClassDefByOrNull("Lapp/morphe/extension/music/patches/downloads/LocalDownloadManager;")?:throw PatchException("Download playlist requires the compatible Morphe Downloads patch. Select Downloads in Full or official 1.48.0.")
        if(manager.methods.none {it.name=="enqueue"&&it.parameterTypes==listOf("Ljava/lang/String;")})throw PatchException("Unsupported Downloads enqueue contract; select compatible Morphe 1.48.0 Downloads")
        val download=manager.methods.singleOrNull {it.name=="downloadBlocking"&&it.parameterTypes.firstOrNull()=="Ljava/lang/String;"}?:throw PatchException("Unsupported typed download completion contract")
        val release=download.implementation!!.instructions.withIndex().filter {(_,i)->i.getReference<MethodReference>()?.let {it.definingClass=="Ljava/util/Set;"&&it.name=="remove"}==true}.map {it.index}
        if(release.isEmpty())throw PatchException("Native download completion/release contract missing")
        for(index in release.reversed())download.addInstruction(index+1,"invoke-static/range { p0 .. p0 }, $RUNTIME->finished(Ljava/lang/String;)V")
        val library=mutableClassDefByOrNull("Lapp/morphe/extension/music/patches/downloads/LocalDownloadsFragment;")?:throw PatchException("Compatible Morphe offline library is required")
        val view=library.methods.singleOrNull {it.name=="onCreateView"&&it.returnType=="Landroid/view/View;"}?:throw PatchException("Native offline library view contract missing")
        for(index in view.implementation!!.instructions.withIndex().filter {it.value.opcode==Opcode.RETURN_OBJECT}.map {it.index}.reversed()){
            val reg=(view.implementation!!.instructions.elementAt(index) as OneRegisterInstruction).registerA
            view.addInstruction(index,"invoke-static/range { v$reg .. v$reg }, Lapp/bdcrusher/ytmusic/playlists/PlaylistSettingsPage;->addLibraryAction(Landroid/view/View;)V")
        }
        CommandResolverFingerprint.method.cloneParameters().apply {
            mutableClassDefBy(parameterTypes[1].toString()).interfaces.add(COMMAND)
            addInstructionsWithLabels(0,"""
                invoke-static { p1 }, $RUNTIME->command($COMMAND)Z
                move-result v0
                if-eqz v0, :native_resolution
                return v0
                :native_resolution
                nop
            """)
        }
    }
}
