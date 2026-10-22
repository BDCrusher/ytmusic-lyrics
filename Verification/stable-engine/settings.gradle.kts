rootProject.name = "ytmusic-stable-engine-verification"
includeBuild("../../BuildSources/morphe-patcher-stable") {
    dependencySubstitution {
        substitute(module("app.morphe:morphe-patcher")).using(project(":"))
    }
}
