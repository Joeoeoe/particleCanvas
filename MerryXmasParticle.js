const isMobile = /Android|webOS|iPhone|iPod|BlackBerry/i.test(navigator.userAgent);
console.log(isMobile);
const FOCUS_POSITION = 1200; //焦点位置
const SPRING = 0.01; //目标距离参数，弹力模型
const FRICTION = 0.9; //摩擦系数，降低粒子速度
const lineHeight = 7;
const particleCount = 1200;
const ArcCanvas = {};//记录粒子canvas绘画
const particleSize = 9;
let canvas, ctx, canvasWidth, canvasHeight, scene, img, heartCanvas;
let mask = document.createElement('div');
mask.style = "position:fixed; width:100%; height:100%;display:flex; justify-content:center; align-items:center; font-size:20px;z-index:9999; top:0;left:0;background-color:#000000";
mask.innerHTML = `<p style="font-size: 100px;color: white">请将屏幕置横</p>`;

window.addEventListener('load', load);
window.addEventListener('resize', reset);

class Particle{
    constructor(centerObj){
        this.center = centerObj;

        //坐标
        this.x = 0, this.y = 0, this.z = 0;

        //方向速度
        this.vx = 0, this.vy = 0, this.vz = 0;

        //下一个位置记录
        this.nextX = 0, this.nextY = 0, this.nextZ = 0;
    }
    setNextPos(vecObj){//设置点的下一个位置
        this.nextX = vecObj.x, this.nextY = vecObj.y, this.nextZ = vecObj.z, this.color = vecObj.color;
    }
    setExercise(){ //设置粒子运动速度及效果等
        //弹力模型
        this.vx += (this.nextX - this.x) * SPRING;
        this.vy += (this.nextY - this.y) * SPRING;
        this.vz += (this.nextZ - this.z) * SPRING;

        //摩擦系数
        this.vx *= FRICTION;
        this.vy *= FRICTION;
        this.vz *= FRICTION;
        //每一帧位置设置
        this.x += this.vx, this.y += this.vy, this.z += this.vz;
    }
    setNextFrame(){
        this.setExercise();

        const t = FOCUS_POSITION / (FOCUS_POSITION + this.z);
        return{
            x:this.center.x + this.x * t,
            y:this.center.y - this.y * t
        };
    }




}
class Scene {
    constructor(ctx, width, height){ //构造函数
        this.ctx = ctx;
        this.draw = this.draw.bind(this);
        this.init(width, height);
    }
    init(width, height){
        this.width = width;
        this.height = height;
        this.center = {
            x: width / 2,
            y: height / 2
        };
        this.geometrys = [];//记录geo的粒子位置
        this.activeGeometry = null; //正在进行的geo的粒子位置
        this.tick = 0; //帧
        this.actionIndex = -1; //动作步骤
        this.particles = [];//粒子列表
        for(let i = 0; i < particleCount; i++){ //初始化粒子
            this.particles.push(new Particle(this.center))
        }
        this.clear();//背景重绘
        cancelAnimationFrame(this.raf);
    }

    clear(){//清除，重绘背景
        this.ctx.fillStyle = "rgba(255,255,245, 0.4)"; //我擦！轨迹是通过背景透明度出来的
        this.ctx.fillRect(0, 0, this.width, this.height)
    }

    build(actions){//构建geometrys数组，记录粒子位置
        this.actions = actions;

        this.geometrys = this.actions.map(
            (obj)=>{//传入每一个geo
                return this.buildGeo(obj.texts);
            }
        );
        this.geometrys.length && this.nextAction();
    }
    buildGeo(texts){//通过文字构建粒子模型,传入文字数组
        let textsArray = [];//每个字为一个元素
        let content = "";//文字全部内容，用于调整大小
        texts.forEach((t)=>{
            content += t.text;
        });
        const w = 200;
        const h = ~~(w * this.height/this.width);
        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');
        measureCanvas.setAttribute('width', w);
        measureCanvas.setAttribute('height', h);
        //默认设置
        measureCtx.fillStyle = "#000";
        measureCtx.font = "bold 12px Arial";
        const origionTM = measureCtx.measureText(content);
        //12为默认字体大小，这里相当于缩放
        const newSize = Math.min(0.8 * h * 12/lineHeight, 0.8 * w * 12/origionTM.width);

        //新size下字体宽度
        measureCtx.font = `bold ${newSize}px Arial`;
        const newTM = measureCtx.measureText(content);
        let x = (w - newTM.width)/2; //起始x位置
        const y = (h + newSize / 12 * lineHeight) / 2;//起始y位置

        texts.forEach((t)=>{
            measureCtx.clearRect(0, 0, w, h);
            measureCtx.fillText(t.text, x, y);
            x += measureCtx.measureText(t.text).width;//
            const imageData = measureCtx.getImageData(0, 0, w, h); //imageData.data中以RGBA顺序标识像素
            const n = [];
            for(let t = 0, i = imageData.width * imageData.height; t < i; t++){ //点
                //Alpha不为0时，即此像素点有颜色时才可推入
                imageData.data[4 * t + 3] && n.push({ //最后除是为了位置缩放
                    x: t % imageData.width / imageData.width,
                    y: t/ imageData.width / imageData.height
                });
            }

            textsArray.push({color: t.hsla, points:n})
        });

        return textsArray;
    }

    nextAction(){//下一个动作设置
        this.actionIndex++;
        this.actionIndex >= this.actions.length && (this.actionIndex = 0);
        this.activeGeometry = this.geometrys[this.actionIndex];
        this.tick = 0;//动作时钟置0
        this.setParticle();
    }

    setParticle(){
        const activeGeoLength = this.activeGeometry.length;
        //从左至右选择字进行设置
        this.particles.forEach((par, i) => {
            // console.log(this.geometrys);
            let fontGeo = this.activeGeometry[i % activeGeoLength];
            // console.log(i % activeGeoLength);
            // console.log(this.activeGeometry);
            // console.log(fontGeo);
            let h = fontGeo.points[~~(Math.random() * fontGeo.points.length)];
            par.setNextPos({
                    x: h.x * canvasWidth - this.center.x,
                    y: (1 - h.y) * canvasHeight - this.center.y,
                    z: ~~(30 * Math.random()),
                    color: fontGeo.color
            })


        })

    }
    renderParticles(){//根据每个粒子最终位置进行绘制，太快了吧
        this.particles.forEach(  (particle)=>{
            const i = particle.setNextFrame();//获取渲染时下一帧的位置
            const colorName = getRGBA(particle.color); //颜色
            ArcCanvas[colorName] || createArcCanvas(colorName);//根据颜色map绘制canvas点
            this.ctx.drawImage(ArcCanvas[colorName], i.x - 2, i.y - 2, particleSize, particleSize);

        } )
    }
    draw(){
        this.tick++;//动画时间
        this.tick >= this.actions[this.actionIndex].lifeTime && this.nextAction();
        this.clear();
        this.renderParticles();
        this.raf = requestAnimationFrame(this.draw);
    }



}
function createArcCanvas(colorName) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.setAttribute('width', particleSize);
    canvas.setAttribute('height', particleSize);
    let gradient = ctx.createRadialGradient(particleSize/2, particleSize/2, 0, particleSize/2, particleSize/2, particleSize/2);
    // gradient.addColorStop(0,'rgba(255,215,0,1)');
    // // gradient.addColorStop(0.005,'rgba(139,69,19,1)');
    // // gradient.addColorStop(0.4,'rgba(139,69,19,1)');
    // // gradient.addColorStop(0.8,'rgba(139,69,19,1)');
    // gradient.addColorStop(1,'rgba(255,255,255,0)');
    // ctx.fillStyle = gradient;

    ctx.fillStyle = colorName;
    ctx.arc(particleSize/2, particleSize/2, particleSize/2, 0, 2 * Math.PI);
    ctx.fill();
    ArcCanvas[colorName] = canvas;





}
function getHSLA(colorObj) {//获取hsla颜色
    return `hsla(${colorObj.h}, ${colorObj.s}, ${colorObj.l}, ${colorObj.a})`
}
function getRGBA(colorObj) {
    return `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, ${colorObj.a})`
}

function load() {
        canvas = document.querySelector('#particle-canvas');
        ctx = canvas.getContext('2d');
        reset();
        (scene = new Scene(ctx, canvasWidth, canvasHeight)).build(Actions);
        scene.draw();
        if( isMobile === true){
            if( (window.orientation >= 0 && window.orientation <= 75) || (window.orientation <= 0 && window.orientation >= -75)){
                document.body.appendChild(mask);
            }
        }
}
function reset() {
    if(isMobile === true){
        if((window.orientation > 75 && window.orientation <= 90) || (window.orientation >= -90 && window.orientation < -75)){
            try{
                document.body.removeChild(mask);
            }catch (e){
            }

        }else{
            document.body.appendChild(mask);
        }
    }
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    const t = window.devicePixelRatio || 1; //获取屏幕比
    canvas.width = canvasWidth * t;
    canvas.height = canvasHeight * t;
    ctx.scale(t, t);
    scene && scene.init(canvasWidth, canvasHeight);
    scene && scene.build(Actions);
    scene && scene.draw();
}

