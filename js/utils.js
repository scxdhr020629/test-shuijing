export const MathUtils = {
    getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    getAngle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    
    // 点到线段距离 (用于激光判定)
    distToSegment: (p, v, w) => {
        const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
        if (l2 === 0) return MathUtils.getDistance(p.x, p.y, v.x, v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return MathUtils.getDistance(p.x, p.y, v.x + t * (w.x - v.x), v.y + t * (w.y - v.y));
    }
};