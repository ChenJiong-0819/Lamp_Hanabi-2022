import { TextBlock, StackPanel, AdvancedDynamicTexture, Image, Button, Rectangle, Control, Grid } from "@babylonjs/gui";
import { Scene, Sound, ParticleSystem, PostProcess, Effect, SceneSerializer } from "@babylonjs/core";

export class Hud {
    private _scene: Scene;

    //Game Timer
    public time: number; //keep track to signal end game REAL TIME
    private _prevTime: number = 0;
    private _clockTime: TextBlock = null; //GAME TIME
    private _startTime: number;
    private _stopTimer: boolean;
    private _sString = "00";
    private _mString = 11;
    private _lanternCnt: TextBlock;

    //Animated UI sprites
    private _sparklerLife: Image;
    private _spark: Image;

    //Timer handlers
    public stopSpark: boolean;
    private _handle;
    private _sparkhandle;

    //Pause toggle
    public gamePaused: boolean;

    //Quit game
    public quit: boolean;
    public transition: boolean = false;

    //UI Elements
    public pauseBtn: Button;
    public fadeLevel: number;
    private _playerUI;
    private _pauseMenu;
    private _controls;


    constructor(scene: Scene) {

        this._scene = scene;

        const playerUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this._playerUI = playerUI;
        this._playerUI.idealHeight = 720;

        const lanternCnt = new TextBlock();
        lanternCnt.name = "lantern count";
        lanternCnt.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        lanternCnt.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        lanternCnt.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        lanternCnt.fontSize = "22px";
        lanternCnt.color = "white";
        lanternCnt.text = "Lanterns: 1 / 22";
        lanternCnt.top = "32px";
        lanternCnt.left = "-64px";
        lanternCnt.width = "25%";
        lanternCnt.fontFamily = "Viga";
        lanternCnt.resizeToFit = true;
        playerUI.addControl(lanternCnt);
        this._lanternCnt = lanternCnt;

        const stackPanel = new StackPanel();
        stackPanel.height = "100%";
        stackPanel.width = "100%";
        stackPanel.top = "14px";
        stackPanel.verticalAlignment = 0;
        playerUI.addControl(stackPanel);

        // 游戏计时器文本
        const clockTime = new TextBlock();
        clockTime.name = "clock";
        clockTime.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        clockTime.fontSize = "48px";
        clockTime.color = "white";
        clockTime.text = "11:00";
        clockTime.resizeToFit = true;
        clockTime.height = "96px";
        clockTime.width = "220px";
        clockTime.fontFamily = "Viga";
        stackPanel.addControl(clockTime);
        this._clockTime = clockTime;

        // 火花棒动画
        const sparklerLife = new Image("sparkLife", "./sprites/sparkLife.png");
        sparklerLife.width = "54px";
        sparklerLife.height = "162px";
        sparklerLife.cellId = 0;
        sparklerLife.cellHeight = 108;
        sparklerLife.cellWidth = 36;
        sparklerLife.sourceWidth = 36;
        sparklerLife.sourceHeight = 108;
        sparklerLife.horizontalAlignment = 0;
        sparklerLife.verticalAlignment = 0;
        sparklerLife.left = "14px";
        sparklerLife.top = "14px";
        playerUI.addControl(sparklerLife);
        this._sparklerLife = sparklerLife;

        const spark = new Image("spark", "./sprites/spark.png");
        spark.width = "40px";
        spark.height = "40px";
        spark.cellId = 0;
        spark.cellHeight = 20;
        spark.cellWidth = 20;
        spark.sourceWidth = 20;
        spark.sourceHeight = 20;
        spark.horizontalAlignment = 0;
        spark.verticalAlignment = 0;
        spark.left = "21px";
        spark.top = "20px";
        playerUI.addControl(spark);
        this._spark = spark;

        const pauseBtn = Button.CreateImageOnlyButton("pauseBtn", "./sprites/pauseBtn.png");
        pauseBtn.width = "48px";
        pauseBtn.height = "86px";
        pauseBtn.thickness = 0;
        pauseBtn.verticalAlignment = 0;
        pauseBtn.horizontalAlignment = 1;
        pauseBtn.top = "-16px";
        playerUI.addControl(pauseBtn);
        pauseBtn.zIndex = 10;
        this.pauseBtn = pauseBtn;
        // 当按钮按下时，使暂停菜单可见并添加控制
        pauseBtn.onPointerDownObservable.add(() => {
            this._pauseMenu.isVisible = true;
            playerUI.addControl(this._pauseMenu);
            this.pauseBtn.isHitTestVisible = false;

            // 游戏暂停时，确保下一次开始时间与暂停时相同
            this.gamePaused = true;
            this._prevTime = this.time;


        });

    }

    public updateHud(): void {
        if (!this._stopTimer && this._startTime != null) {
            let curTime = Math.floor((new Date().getTime() - this._startTime) / 1000) + this._prevTime; // 除以1000得到秒

            this.time = curTime; // 以秒为单位记录所用的总时间
            this._clockTime.text = this._formatTime(curTime);
        }
    }

    public updateLanternCount(numLanterns: number): void {
        this._lanternCnt.text = "Lanterns: " + numLanterns + " / 22";
    }

    // ----游戏计时器----
    public startTimer(): void {
        this._startTime = new Date().getTime();// 获取我们开始的时间 
        this._stopTimer = false;
    }
    public stopTimer(): void {
        this._stopTimer = true;// 控制我们定时器的更新
    }

    // 设置时间格式，使其相对于11:00——比赛时间
    private _formatTime(time: number): string {
        let minsPassed = Math.floor(time / 60); // 一分钟几秒钟
        let secPassed = time % 240; // 4分钟/240秒后返回0
        // 游戏时钟的工作原理是：4分钟=1小时
        // 4秒=1/15=1分钟比赛时间     
        if (secPassed % 4 == 0) {
            this._mString = Math.floor(minsPassed / 4) + 11;
            this._sString = (secPassed / 4 < 10 ? "0" : "") + secPassed / 4;
        }
        let day = (this._mString == 11 ? " PM" : " AM");
        return (this._mString + ":" + this._sString + day);
    }

    // ----闪光计时器----
    // 启动并重新启动Sparker，控制纹理和动画帧的设置
    public startSparklerTimer(): void {
        // 重置火花计时器和动画帧
        this.stopSpark = false;
        this._sparklerLife.cellId = 0;
        this._spark.cellId = 0;
        if (this._handle) {
            clearInterval(this._handle);
        }
        if (this._sparkhandle) {
            clearInterval(this._sparkhandle);
        }

        this._scene.getLightByName("sparklight").intensity = 35;

        // sparkler动画，每2秒更新10条sparklife
        this._handle = setInterval(() => {
            if (!this.gamePaused) {
                if (this._sparklerLife.cellId < 10) {
                    this._sparklerLife.cellId++;
                }
                if (this._sparklerLife.cellId == 9) {
                }
                if (this._sparklerLife.cellId == 10) {
                    this.stopSpark = true;
                    clearInterval(this._handle);
                }
            }
        }, 2000);

        this._sparkhandle = setInterval(() => {
            if (!this.gamePaused) {
                if (this._sparklerLife.cellId < 10 && this._spark.cellId < 5) {
                    this._spark.cellId++;
                } else if (this._sparklerLife.cellId < 10 && this._spark.cellId >= 5) {
                    this._spark.cellId = 0;
                }
                else {
                    this._spark.cellId = 0;
                    clearInterval(this._sparkhandle);
                }
            }
        }, 185);
    }

    // 停止闪烁，重置纹理
    public stopSparklerTimer(): void {
        this.stopSpark = true;

        this._scene.getLightByName("sparklight").intensity = 0;
    }

    // ----暂停菜单弹出窗口----
    private _createPauseMenu(): void {
        this.gamePaused = false;

        const pauseMenu = new Rectangle();
        pauseMenu.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        pauseMenu.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        pauseMenu.height = 0.8;
        pauseMenu.width = 0.5;
        pauseMenu.thickness = 0;
        pauseMenu.isVisible = false;

        // 背景图像
        const image = new Image("pause", "sprites/pause.jpeg");
        pauseMenu.addControl(image);

        // 按钮的堆栈面板
        const stackPanel = new StackPanel();
        stackPanel.width = .83;
        pauseMenu.addControl(stackPanel);

        const resumeBtn = Button.CreateSimpleButton("resume", "RESUME");
        resumeBtn.width = 0.18;
        resumeBtn.height = "44px";
        resumeBtn.color = "white";
        resumeBtn.fontFamily = "Viga";
        resumeBtn.paddingBottom = "14px";
        resumeBtn.cornerRadius = 14;
        resumeBtn.fontSize = "12px";
        resumeBtn.textBlock.resizeToFit = true;
        resumeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        resumeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        stackPanel.addControl(resumeBtn);

        this._pauseMenu = pauseMenu;

        // 当按钮按下时，使菜单不可见并取消对菜单的控制
        resumeBtn.onPointerDownObservable.add(() => {
            this._pauseMenu.isVisible = false;
            this._playerUI.removeControl(pauseMenu);
            this.pauseBtn.isHitTestVisible = true;

            // 比赛未暂停，我们的时间现在重置
            this.gamePaused = false;
            this._startTime = new Date().getTime();

        });

        const controlsBtn = Button.CreateSimpleButton("controls", "CONTROLS");
        controlsBtn.width = 0.18;
        controlsBtn.height = "44px";
        controlsBtn.color = "white";
        controlsBtn.fontFamily = "Viga";
        controlsBtn.paddingBottom = "14px";
        controlsBtn.cornerRadius = 14;
        controlsBtn.fontSize = "12px";
        resumeBtn.textBlock.resizeToFit = true;
        controlsBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        controlsBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

        stackPanel.addControl(controlsBtn);

        // 当按钮按下时，使菜单不可见并取消对菜单的控制
        controlsBtn.onPointerDownObservable.add(() => {
            // 打开控制屏幕
            this._controls.isVisible = true;
            this._pauseMenu.isVisible = false;

        });

        const quitBtn = Button.CreateSimpleButton("quit", "QUIT");
        quitBtn.width = 0.18;
        quitBtn.height = "44px";
        quitBtn.color = "white";
        quitBtn.fontFamily = "Viga";
        quitBtn.paddingBottom = "12px";
        quitBtn.cornerRadius = 14;
        quitBtn.fontSize = "12px";
        resumeBtn.textBlock.resizeToFit = true;
        quitBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        quitBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        stackPanel.addControl(quitBtn);

        // 建立过渡效应
        Effect.RegisterShader("fade",
            "precision highp float;" +
            "varying vec2 vUV;" +
            "uniform sampler2D textureSampler; " +
            "uniform float fadeLevel; " +
            "void main(void){" +
            "vec4 baseColor = texture2D(textureSampler, vUV) * fadeLevel;" +
            "baseColor.a = 1.0;" +
            "gl_FragColor = baseColor;" +
            "}");
        this.fadeLevel = 1.0;

        quitBtn.onPointerDownObservable.add(() => {
            const postProcess = new PostProcess("Fade", "fade", ["fadeLevel"], null, 1.0, this._scene.getCameraByName("cam"));
            postProcess.onApply = (effect) => {
                effect.setFloat("fadeLevel", this.fadeLevel);
            };
            this.transition = true;

        })
    }

    // ---- Controls Menu Popup ----
    private _createControlsMenu(): void {
        const controls = new Rectangle();
        controls.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        controls.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        controls.height = 0.8;
        controls.width = 0.5;
        controls.thickness = 0;
        controls.color = "white";
        controls.isVisible = false;
        this._playerUI.addControl(controls);
        this._controls = controls;

        // 背景图
        const image = new Image("controls", "sprites/controls.jpeg");
        controls.addControl(image);

        const title = new TextBlock("title", "CONTROLS");
        title.resizeToFit = true;
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        title.fontFamily = "Viga";
        title.fontSize = "32px";
        title.top = "14px";
        controls.addControl(title);

        const backBtn = Button.CreateImageOnlyButton("back", "./sprites/lanternbutton.jpeg");
        backBtn.width = "40px";
        backBtn.height = "40px";
        backBtn.top = "14px";
        backBtn.thickness = 0;
        backBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        backBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        controls.addControl(backBtn);

        // 当按钮按下时，使菜单不可见并取消对菜单的控制
        backBtn.onPointerDownObservable.add(() => {
            this._pauseMenu.isVisible = true;
            this._controls.isVisible = false;

        });
    }
}